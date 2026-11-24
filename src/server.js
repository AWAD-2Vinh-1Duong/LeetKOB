import pino from 'pino';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createPool } from './shared/db.js';

const config = loadConfig(process.env);
const logger = pino({ level: config.logLevel });
const pool = createPool(config.databaseUrl);
const app = createApp({ jwtSecret: config.jwtSecret, pool, logger });

const server = app.listen(config.port, () => {
  logger.info({ port: config.port }, 'LeeTKOB is listening');
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    logger.info({ signal }, 'Shutting down');
    server.close(() => pool.end().finally(() => process.exit(0)));
  });
}
