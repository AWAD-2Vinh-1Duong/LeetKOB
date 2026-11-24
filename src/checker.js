// The checker command: node src/checker.js --data <dataset-dir> [--out <predictions.jsonl>] [--call-log <file>]
// MODEL_OFF=1 runs the hard rules only, writes `unsure` for every semantic constraint and
// opens no network connection. Otherwise semantic constraints go to the model named by
// LLM_BASE_URL, LLM_MODEL and LLM_API_KEY. Like server.js, this entry point may read process.env.
import { writeFile } from 'node:fs/promises';
import { checkDataset } from './modules/grading/service/check-dataset.js';
import { ConstraintJudge } from './modules/grading/service/constraint-judge.js';
import { createOpenAICompatibleModel } from './modules/grading/service/openai-compatible-model.js';

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
  let judge = null;
  if (process.env.MODEL_OFF !== '1') {
    const env = process.env;
    const missing = ['LLM_BASE_URL', 'LLM_MODEL', 'LLM_API_KEY'].filter(
      (name) => !env[name],
    );
    if (missing.length > 0) {
      process.stderr.write(
        `Set ${missing.join(', ')} to call the model, or MODEL_OFF=1 to run without it.\n`,
      );
      return 1;
    }
    judge = new ConstraintJudge({
      model: createOpenAICompatibleModel({
        baseUrl: String(env.LLM_BASE_URL),
        apiKey: String(env.LLM_API_KEY),
        model: String(env.LLM_MODEL),
        prices: {
          inputUsdPerMTok: Number(env.LLM_INPUT_USD_PER_MTOK || 0),
          outputUsdPerMTok: Number(env.LLM_OUTPUT_USD_PER_MTOK || 0),
        },
      }),
      timeoutMs: Number(env.LLM_TIMEOUT_MS || 60_000),
    });
  }

  const { predictions, calls } = await checkDataset(args.data, { judge });
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
