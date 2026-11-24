// The checker command: node src/checker.js --data <dataset-dir> [--out <predictions.jsonl>] [--call-log <file>]
// MODEL_OFF=1 runs the hard rules only, writes `unsure` for every semantic constraint and
// opens no network connection. Like server.js, this entry point is allowed to read process.env.
import { writeFile } from 'node:fs/promises';
import { checkDataset } from './modules/grading/service/check-dataset.js';

const USAGE =
  'usage: MODEL_OFF=1 node src/checker.js --data <dataset-dir> [--out <predictions.jsonl>] [--call-log <calls.jsonl>]\n';

/** @param {string[]} argv */
function parseArgs(argv) {
  /** @type {Record<string, string>} */
  const args = {};
  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i];
    if (
      !['--data', '--out', '--call-log'].includes(flag) ||
      i + 1 >= argv.length
    ) {
      return null;
    }
    args[flag.slice(2)] = argv[i + 1];
  }
  return args.data ? args : null;
}

/** @param {unknown[]} rows */
const toJsonl = (rows) => rows.map((r) => JSON.stringify(r)).join('\n') + '\n';

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args) {
    process.stderr.write(USAGE);
    return 1;
  }
  if (process.env.MODEL_OFF !== '1') {
    // shortcut: only the model-off mode exists until the Gemini model lands (T13).
    process.stderr.write(
      'Only MODEL_OFF=1 is supported until the real model is wired in (T13).\n',
    );
    return 1;
  }

  const { predictions, calls } = await checkDataset(args.data, { judge: null });
  if (args.out) await writeFile(args.out, toJsonl(predictions));
  else process.stdout.write(toJsonl(predictions));
  if (args['call-log'])
    await writeFile(args['call-log'], calls.length ? toJsonl(calls) : '');
  return 0;
}

process.exitCode = await main().catch((err) => {
  process.stderr.write(
    `checker failed: ${err instanceof Error ? err.message : String(err)}\n`,
  );
  return 1;
});
