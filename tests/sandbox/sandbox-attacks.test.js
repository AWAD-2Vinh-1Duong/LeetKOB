// Tests for T06/T07: 9 minimum sandbox security attack submissions (M1-M9).
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import {
  buildDockerRunArgs,
  loadSandboxLimits,
  runInSandbox,
} from '../../src/modules/grading/service/sandbox-runner.js';

const execFileAsync = promisify(execFile);
const ATTACKS_DIR = join(import.meta.dirname, 'attacks');
const runDocker = process.env.SANDBOX_DOCKER === '1';

export const ATTACK_SPECS = [
  { id: 'M1', file: 'm1-network.cpp', marker: 'connect(' },
  { id: 'M2', file: 'm2-cpu-limit.cpp', marker: 'while (true)' },
  { id: 'M3', file: 'm3-wall-limit.cpp', marker: 'sleep(30)' },
  { id: 'M4', file: 'm4-memory-limit.cpp', marker: 'checksum' },
  { id: 'M5', file: 'm5-pids-limit.cpp', marker: 'fork()' },
  { id: 'M6', file: 'm6-output-limit.cpp', marker: 'STDOUT_FILENO' },
  { id: 'M7', file: 'm7-non-root.cpp', marker: 'geteuid()' },
  { id: 'M8', file: 'm8-no-host-or-sock.cpp', marker: '/var/run/docker.sock' },
  { id: 'M9', file: 'm9-no-secrets.cpp', marker: 'LLM_API_KEY' },
];

describe('Sandbox minimum security attack submissions (M1-M9)', () => {
  for (const spec of ATTACK_SPECS) {
    test(`${spec.id} (${spec.file}) exists and exercises its attack vector`, async () => {
      const source = await readFile(join(ATTACKS_DIR, spec.file), 'utf8');
      assert.ok(source.length > 0);
      assert.ok(source.includes(spec.marker));
    });
  }

  test('buildDockerRunArgs enforces all 9 hardening flags and passes only SANDBOX_* env', () => {
    const limits = loadSandboxLimits({});
    const args = buildDockerRunArgs({
      containerName: 'leetkob-sbx-test',
      image: 'leetkob-sandbox',
      limits,
    });
    const joined = args.join(' ');
    assert.ok(joined.includes('--network none'));
    assert.ok(joined.includes('--read-only'));
    assert.ok(joined.includes('--user 10001:10001'));
    assert.ok(joined.includes('--cap-drop ALL'));
    assert.ok(joined.includes('--security-opt no-new-privileges:true'));
    assert.ok(
      joined.includes(
        `--memory ${limits.memoryMb}m --memory-swap ${limits.memoryMb}m`,
      ),
    );
    assert.ok(joined.includes(`--pids-limit ${limits.maxProcesses}`));
    assert.ok(!args.includes('-v') && !args.includes('--volume'));
    assert.ok(!joined.includes('docker.sock'));
    assert.ok(!joined.includes('LLM_API_KEY'));
    assert.ok(!joined.includes('DATABASE_URL'));
  });
});

describe(
  'Docker sandbox execution against 9 attacks (M1-M9)',
  { skip: !runDocker },
  () => {
    test('compiles and runs a benign C++ submission inside the sandbox', async () => {
      const res = await runInSandbox({
        source:
          '#include <iostream>\nint main(){ int a,b; std::cin >> a >> b; std::cout << (a+b) << "\\n"; }\n',
        input: '19 23\n',
      });
      assert.equal(res.outcome, 'ok');
      assert.equal(res.stdout, '42\n');
    });

    test('M1: blocks outbound network connections (--network none)', async () => {
      const source = await readFile(
        join(ATTACKS_DIR, 'm1-network.cpp'),
        'utf8',
      );
      const res = await runInSandbox({ source });
      assert.notEqual(res.outcome, 'ok');
      assert.ok(!res.stdout.includes('NETWORK_ESCAPED'));
    });

    test('M2: kills CPU-bound infinite loop at CPU time limit', async () => {
      const source = await readFile(
        join(ATTACKS_DIR, 'm2-cpu-limit.cpp'),
        'utf8',
      );
      const res = await runInSandbox({
        source,
        limits: { cpuTimeMs: 1000, wallTimeMs: 10_000 },
      });
      assert.equal(res.outcome, 'cpu-limit');
    });

    test('M3: wall-clock limit kills the container itself (not just child process)', async () => {
      const source = await readFile(
        join(ATTACKS_DIR, 'm3-wall-limit.cpp'),
        'utf8',
      );
      const res = await runInSandbox({
        source,
        limits: { wallTimeMs: 1500, cpuTimeMs: 10_000 },
      });
      assert.equal(res.outcome, 'wall-limit');
      assert.ok(!res.stdout.includes('WALL_ESCAPED'));

      const { stdout } = await execFileAsync('docker', [
        'ps',
        '--filter',
        'name=leetkob-sbx-',
        '--format',
        '{{.Names}}',
      ]);
      assert.equal(stdout.trim(), '');
    });

    test('M4: OOM-kills memory+swap allocation when pages are read/written', async () => {
      const source = await readFile(
        join(ATTACKS_DIR, 'm4-memory-limit.cpp'),
        'utf8',
      );
      const res = await runInSandbox({
        source,
        limits: { memoryMb: 64, wallTimeMs: 15_000 },
      });
      assert.equal(res.outcome, 'memory-limit');
      assert.ok(!res.stdout.includes('MEMORY_ESCAPED'));
    });

    test('M5: blocks fork bomb via --pids-limit', async () => {
      const source = await readFile(
        join(ATTACKS_DIR, 'm5-pids-limit.cpp'),
        'utf8',
      );
      const res = await runInSandbox({
        source,
        limits: { maxProcesses: 32, wallTimeMs: 10_000 },
      });
      assert.notEqual(res.outcome, 'ok');
      assert.ok(!res.stdout.includes('PIDS_ESCAPED'));
    });

    test('M6: kills infinite stdout flood at output size limit', async () => {
      const source = await readFile(
        join(ATTACKS_DIR, 'm6-output-limit.cpp'),
        'utf8',
      );
      const res = await runInSandbox({
        source,
        limits: { maxOutputKb: 32, wallTimeMs: 10_000 },
      });
      assert.equal(res.outcome, 'output-limit');
      assert.ok(Buffer.byteLength(res.stdout, 'utf8') <= 32 * 1024);
    });

    test('M7: runs as non-root user and denies /root writes', async () => {
      const source = await readFile(
        join(ATTACKS_DIR, 'm7-non-root.cpp'),
        'utf8',
      );
      const res = await runInSandbox({ source });
      assert.notEqual(res.outcome, 'ok');
      assert.ok(res.stdout.includes('NON_ROOT_OK'));
      assert.ok(!res.stdout.includes('ROOT_ESCAPED'));
    });

    test('M8: blocks host mounts and /var/run/docker.sock access', async () => {
      const source = await readFile(
        join(ATTACKS_DIR, 'm8-no-host-or-sock.cpp'),
        'utf8',
      );
      const res = await runInSandbox({ source });
      assert.notEqual(res.outcome, 'ok');
      assert.ok(res.stdout.includes('HOST_AND_SOCK_BLOCKED'));
      assert.ok(!res.stdout.includes('ESCAPED'));
    });

    test('M9: strips LLM_API_KEY, DATABASE_URL, JWT_SECRET and .env from sandbox', async () => {
      const prevApiKey = process.env.LLM_API_KEY;
      const prevDb = process.env.DATABASE_URL;
      process.env.LLM_API_KEY = 'dummy-secret-for-sandbox-test';
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost/db';
      try {
        const source = await readFile(
          join(ATTACKS_DIR, 'm9-no-secrets.cpp'),
          'utf8',
        );
        const res = await runInSandbox({ source });
        assert.notEqual(res.outcome, 'ok');
        assert.ok(res.stdout.includes('NO_SECRETS_OK'));
        assert.ok(!res.stdout.includes('ESCAPED'));
      } finally {
        if (prevApiKey === undefined) delete process.env.LLM_API_KEY;
        else process.env.LLM_API_KEY = prevApiKey;
        if (prevDb === undefined) delete process.env.DATABASE_URL;
        else process.env.DATABASE_URL = prevDb;
      }
    });
  },
);
