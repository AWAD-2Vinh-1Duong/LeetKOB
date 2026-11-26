// Tests for T06/T07: 9 minimum sandbox security attack submissions (M1-M9).
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const ATTACKS_DIR = join(import.meta.dirname, 'attacks');

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
});
