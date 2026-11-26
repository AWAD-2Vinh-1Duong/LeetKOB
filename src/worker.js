// Isolated background worker process. Pulls jobs from PostgreSQL using FOR UPDATE SKIP LOCKED.
// Like server.js, this entry point may read process.env and wires dependencies through container.js.
import pino from 'pino';
import { loadConfig } from './config.js';
import { createPool } from './shared/db.js';
import { createWorkerContainer } from './container.js';
import { ConstraintJudge } from './modules/grading/service/constraint-judge.js';
import { createOpenAICompatibleModel } from './modules/grading/service/openai-compatible-model.js';

const config = loadConfig(process.env);
const logger = pino({ level: config.logLevel });
const pool = createPool(config.databaseUrl);

let judge = null;
if (
  process.env.MODEL_OFF !== '1' &&
  process.env.LLM_BASE_URL &&
  process.env.LLM_MODEL &&
  process.env.LLM_API_KEY
) {
  judge = new ConstraintJudge({
    model: createOpenAICompatibleModel({
      baseUrl: String(process.env.LLM_BASE_URL),
      apiKey: String(process.env.LLM_API_KEY),
      model: String(process.env.LLM_MODEL),
      prices: {
        inputUsdPerMTok: Number(process.env.LLM_INPUT_USD_PER_MTOK || 0),
        outputUsdPerMTok: Number(process.env.LLM_OUTPUT_USD_PER_MTOK || 0),
      },
    }),
    timeoutMs: Number(process.env.LLM_TIMEOUT_MS || 60_000),
  });
}

const pollIntervalMs = Number(process.env.WORKER_POLL_INTERVAL_MS || 500);
const { worker } = createWorkerContainer({
  pool,
  judge,
  logger,
  pollIntervalMs,
});

worker.start();
logger.info({ workerId: worker.workerId, pollIntervalMs }, 'Worker started');

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    logger.info({ signal, workerId: worker.workerId }, 'Worker shutting down');
    worker
      .stop()
      .then(() => pool.end())
      .finally(() => process.exit(0));
  });
}
