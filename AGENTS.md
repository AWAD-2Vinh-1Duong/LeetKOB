# AGENTS.md — LeeTKOB rules for coding agents

Read this before touching the LeeTKOB grading harness. Tool-specific files (`CLAUDE.md`, `.github/copilot-instructions.md`) only add to it.

- Each change must be reported in each file `context-dd-mm` in `LeetKOB/docs/tasks/PA-<number>/context` based on the PA number which you are working on.

## 1. Stack

- Node.js 22 LTS, ESM, JavaScript with JSDoc and strict `checkJs`; no other language, npm only.
- Express 5 in one process, code grouped by feature (`src/auth`, `src/labs`, `src/submissions`, `src/shared`); layers and rules are in section 6 and `docs/architecture.md`.
- `zod` validation, JWT with `jose`, passwords hashed with `scrypt` from `node:crypto`.
- Tests: `node:test` + `supertest`. Lint/format: ESLint 10 flat config + Prettier 3.
- PostgreSQL 16 via `pg` and plain SQL, migrations with `node-pg-migrate`; job queue in a table claimed with `FOR UPDATE SKIP LOCKED`; `pino` logging with request IDs.
- Sandbox: own Docker runner meeting section 4. LLM: `ConstraintJudge` adapter, Gemini `gemini-3.6-flash` on the free tier, model set by `LLM_MODEL`.

## 2. Commands

Local and CI run the same commands. `npm run check` runs all four in order.

- `npm run lint` · `npm run format:check` · `npm run typecheck` · `npm test`
- `npm run format` fixes formatting.
- `npm run dev` starts the application in development mode (`node --watch src/app.js`).
- `npm run db:migrate` runs database migrations with `node-pg-migrate`.

## 3. Conventions

- Every HTTP error is RFC 9457 problem details (`type`, `title`, `status`, `detail`, `instance`), `type` = `https://leettkob.dev/problems/<slug>` with the slug declared in the endpoint contract. Never ad-hoc `{ code, message }`.
- Mutations (submit, publish) honour an `Idempotency-Key`, stored with a unique index by the repository. Lists and queues page with cursors.
- Named exports only; the one exception is a tool config loaded by default export (`eslint.config.js`). No `console.log` in `src/`.
- Commits: Conventional Commits `<type>(<scope>): <summary>`, ≤ 72 chars, imperative, no final period. Types `feat fix test ci docs chore refactor`; scopes `contract submissions sandbox auth rules`. Never "update code" or "fix bug".
- Branches: `feat/*`, `test/*`, `fix/*`, `gate/*`. Newest `AI-LOG.md` entry goes on top.
- **Deliberate breaks only on `gate/*`.** A lint-breaking line meant for `gate/ci-test` landed on `main` in `cfcb089`; run `git branch --show-current` before committing a deliberate failure.
- **Verify before claiming.** The 2026-10-30 AI-LOG entry said `ci.yml` was added, but the file was empty. Open a file or workflow before saying it exists or works, and check a CI step can fail.

## 4. Never

- Never expose the model API key, database credentials or any `.env` value to the sandbox: not its environment, filesystem, image, or anything the compiler can `#include`.
- Never relax the sandbox baselines: no network (`--network none`); limits on CPU time, wall time (killing container, not just child process), memory + swap (always read back allocated memory in test to prevent compiler `-O2` elimination), processes (`pids-limit`), and output size; non-root user (`geteuid() != 0`); no host mounts; no Docker socket (`/var/run/docker.sock`); no `--privileged` or `--env-file`.
- Never call a real model in unit, contract or CI eval runs; use stubs or recorded fixtures. Live model runs are manual only.
- Never edit a test, an eval case, a label, or a threshold in `eval.mjs` to make a check pass. Change the code.
- Never edit `eval.mjs` (SHA-256 starts `c836edd8713521bb`), `labels.jsonl` (SHA-256 starts `262cda7b0ef5612e`), or any dev-set `.cpp` file.
- Never hardcode dev-set problem IDs (such as `sort-merge/s05`) or quote dev-set code in prompts or hard rules.
- Never allow a model verdict to alter student marks directly without explicit TA review in the Review Queue (Zero-Tolerance syllabus rule).
- Never use model output without schema validation and timeout checks (falling back to `unsure`).
- Never fake a dev-set run: committed `call-log.jsonl` must contain genuine provider request IDs, models, tokens, latency, and cost per call.
- Never make a CI step pass silently (`|| true`, `continue-on-error`, an empty workflow).
- Never push to `main`; everything goes through a pull request with the required `quality` check green.

## 5. Permissions

Tier 3 overrides Tiers 1 and 2.

- **Tier 1, run freely:** read and search files; `git status`, `git diff`; the commands in section 2.
- **Tier 2, ask first:** `git push` or opening a pull request; adding, updating or removing a dependency; writing a migration; changing CI configuration.
- **Tier 3, never (a human does it):** migrating the production database; deploy or rollback; deleting records, dropping tables or rotating keys; sending email or charging users; reading, printing or editing `.env`, or copying a secret into code, a commit, a log, a chat or `AI-LOG.md`; changing the provider's spending cap or billing.

## 6. Code layout

Full rules and the "add a feature" checklist: `docs/architecture.md`. ESLint enforces the layer rules; do not disable them.

- A feature lives in `src/<feature>/` as `<feature>.routes.js`, `.controller.js`, `.service.js`, `.repository.js` (interface only), `.repository.postgres.js`, `.repository.memory.js`.
- Routes map paths; a controller parses the body (zod, `parseBody`) and calls a service; a service holds the rules; a repository only stores data.
- Only `src/container.js` builds repositories, services and controllers, and picks PostgreSQL or in-memory. Only it imports a concrete repository. A class never builds its collaborators or reads `process.env`.
- Errors are `ProblemError` thrown from services; `shared/error-handler.js` turns them into RFC 9457. A response for "exists but not yours" is the same 404 as for "does not exist".
- Start work by writing the contract in `docs/contract/` and the tests in `tests/<feature>/`, then the code.
