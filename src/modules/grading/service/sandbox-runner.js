import { spawn, execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/**
 * @typedef {{
 *   cpuTimeMs: number,
 *   wallTimeMs: number,
 *   memoryMb: number,
 *   maxProcesses: number,
 *   maxOutputKb: number,
 * }} SandboxLimits
 * @typedef {'ok' | 'compile-error' | 'runtime-error' | 'wall-limit' | 'cpu-limit' | 'memory-limit' | 'output-limit'} SandboxOutcome
 * @typedef {{
 *   outcome: SandboxOutcome,
 *   exitCode: number | null,
 *   stdout: string,
 *   stderr: string,
 *   durationMs: number,
 * }} SandboxResult
 */

const DEFAULT_LIMITS = {
  cpuTimeMs: 2000,
  wallTimeMs: 5000,
  memoryMb: 64,
  maxProcesses: 32,
  maxOutputKb: 64,
};

/**
 * Reads only SANDBOX_* limits from env. Never reads LLM_* or DATABASE_URL.
 * @param {Record<string, string | undefined>} [env]
 * @returns {SandboxLimits}
 */
export function loadSandboxLimits(env = process.env) {
  /** @param {string} key @param {number} fallback */
  const num = (key, fallback) => {
    const raw = env[key];
    if (!raw) return fallback;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  };
  return {
    cpuTimeMs: num('SANDBOX_CPU_TIME_MS', DEFAULT_LIMITS.cpuTimeMs),
    wallTimeMs: num('SANDBOX_WALL_TIME_MS', DEFAULT_LIMITS.wallTimeMs),
    memoryMb: num('SANDBOX_MEMORY_MB', DEFAULT_LIMITS.memoryMb),
    maxProcesses: num('SANDBOX_MAX_PROCESSES', DEFAULT_LIMITS.maxProcesses),
    maxOutputKb: num('SANDBOX_MAX_OUTPUT_KB', DEFAULT_LIMITS.maxOutputKb),
  };
}

/**
 * Builds hardened `docker run` arguments enforcing all 9 sandbox minimums:
 * --network none, --read-only + tmpfs /work, non-root uid/gid 10001,
 * --memory == --memory-swap, --pids-limit, --cap-drop ALL, no host mounts,
 * no docker.sock, and only SANDBOX_* environment variables.
 * @param {{
 *   containerName: string,
 *   image: string,
 *   limits: SandboxLimits,
 * }} opts
 * @returns {string[]}
 */
export function buildDockerRunArgs({ containerName, image, limits }) {
  const cpuSeconds = Math.max(1, Math.ceil(limits.cpuTimeMs / 1000));
  const script = [
    'set -eu',
    'IFS= read -r src_b64',
    'IFS= read -r in_b64',
    'printf "%s" "$src_b64" | base64 -d > /work/main.cpp',
    'printf "%s" "$in_b64" | base64 -d > /work/input.txt',
    'g++ -std=c++17 -O2 /work/main.cpp -o /work/main || exit 97',
    '/work/main < /work/input.txt',
  ].join('; ');

  return [
    'run',
    '--rm',
    '-i',
    '--name',
    containerName,
    '--network',
    'none',
    '--read-only',
    '--tmpfs',
    '/work:rw,exec,nosuid,nodev,size=64m,uid=10001,gid=10001',
    '--user',
    '10001:10001',
    '--cap-drop',
    'ALL',
    '--security-opt',
    'no-new-privileges:true',
    '--memory',
    `${limits.memoryMb}m`,
    '--memory-swap',
    `${limits.memoryMb}m`,
    '--pids-limit',
    String(limits.maxProcesses),
    '--ulimit',
    `cpu=${cpuSeconds}:${cpuSeconds}`,
    '--ulimit',
    'fsize=10485760',
    '-e',
    'TMPDIR=/work',
    '-e',
    `SANDBOX_CPU_TIME_MS=${limits.cpuTimeMs}`,
    '-e',
    `SANDBOX_WALL_TIME_MS=${limits.wallTimeMs}`,
    '-e',
    `SANDBOX_MEMORY_MB=${limits.memoryMb}`,
    '-e',
    `SANDBOX_MAX_PROCESSES=${limits.maxProcesses}`,
    '-e',
    `SANDBOX_MAX_OUTPUT_KB=${limits.maxOutputKb}`,
    image,
    '/bin/sh',
    '-c',
    script,
  ];
}

/**
 * Compiles and executes C++ source code inside an isolated Docker sandbox container.
 * @param {{
 *   source: string,
 *   input?: string,
 *   image?: string,
 *   limits?: Partial<SandboxLimits>,
 * }} req
 * @returns {Promise<SandboxResult>}
 */
export async function runInSandbox({
  source,
  input = '',
  image = process.env.SANDBOX_IMAGE || 'leetkob-sandbox',
  limits: partialLimits = {},
}) {
  const limits = { ...loadSandboxLimits(process.env), ...partialLimits };
  const maxOutputBytes = limits.maxOutputKb * 1024;
  const containerName = `leetkob-sbx-${randomUUID().slice(0, 12)}`;
  const args = buildDockerRunArgs({ containerName, image, limits });

  const started = Date.now();
  // Strip all host secrets from the docker CLI child process environment.
  const child = spawn('docker', args, {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      PATH: process.env.PATH || '/usr/local/bin:/usr/bin:/bin',
    },
  });

  const srcB64 = Buffer.from(source, 'utf8').toString('base64');
  const inB64 = Buffer.from(input, 'utf8').toString('base64');
  child.stdin.write(`${srcB64}\n${inB64}\n`);
  child.stdin.end();

  /** @type {Buffer[]} */
  const outChunks = [];
  /** @type {Buffer[]} */
  const errChunks = [];
  let totalBytes = 0;
  /** @type {'wall-limit' | 'output-limit' | null} */
  let killedReason = null;
  /** @type {Promise<unknown> | null} */
  let rmPromise = null;

  const killContainer = (
    /** @type {'wall-limit' | 'output-limit'} */ reason,
  ) => {
    if (killedReason) return;
    killedReason = reason;
    // Kill the container itself (M3), not just the client process.
    rmPromise = execFileAsync('docker', ['rm', '-f', containerName]).catch(
      () => {},
    );
    child.kill('SIGKILL');
  };

  /** @param {Buffer[]} target @param {Buffer} chunk */
  const collect = (target, chunk) => {
    if (killedReason) return;
    const remaining = maxOutputBytes - totalBytes;
    if (chunk.length > remaining) {
      if (remaining > 0) target.push(chunk.subarray(0, remaining));
      totalBytes = maxOutputBytes;
      killContainer('output-limit');
      return;
    }
    target.push(chunk);
    totalBytes += chunk.length;
  };

  child.stdout.on('data', (chunk) => collect(outChunks, chunk));
  child.stderr.on('data', (chunk) => collect(errChunks, chunk));

  const wallTimer = setTimeout(
    () => killContainer('wall-limit'),
    limits.wallTimeMs,
  );
  wallTimer.unref?.();

  /** @type {number | null} */
  const exitCode = await new Promise((resolve) => {
    child.on('close', (code) => resolve(code));
    child.on('error', () => resolve(1));
  });
  clearTimeout(wallTimer);

  // Ensure no orphan container remains on any termination path.
  if (rmPromise) {
    await rmPromise;
  }

  const stdout = Buffer.concat(outChunks).toString('utf8');
  const stderr = Buffer.concat(errChunks).toString('utf8');
  const durationMs = Date.now() - started;

  /** @type {SandboxOutcome} */
  let outcome = 'ok';
  if (killedReason) {
    outcome = killedReason;
  } else if (exitCode === 97) {
    outcome = 'compile-error';
  } else if (exitCode === 152) {
    outcome = 'cpu-limit';
  } else if (exitCode === 137) {
    outcome = durationMs >= limits.cpuTimeMs ? 'cpu-limit' : 'memory-limit';
  } else if (exitCode !== 0) {
    outcome = 'runtime-error';
  }

  return { outcome, exitCode, stdout, stderr, durationMs };
}
