# AGENTS.md — LeeTKOB Rules & Assistant Permissions

You are an AI programming assistant working on the LeeTKOB grading harness and platform. Read and strictly follow these rules before inspecting, suggesting, or modifying any code in this repository.

---

## 1. Stack

- **Runtime & Language:** Node.js 22 LTS, ESM, JavaScript with JSDoc and strict `checkJs`.
- **HTTP:** Express 5.
- **Architecture:** One process with controllers → services → repositories; inject dependencies through constructors.
- **Database:** PostgreSQL 16 via `pg`, using SQL directly; manage schema changes with `node-pg-migrate`.
- **Queue:** PostgreSQL table; claim jobs with `FOR UPDATE SKIP LOCKED`.
- **Validation:** `zod`.
- **Tests:** `node:test` and `supertest`.
- **Lint / Format:** ESLint 10 flat config and Prettier 3.
- **Authentication:** JWT with `jose`; password hashing with `scrypt` from `node:crypto`.
- **Sandbox:** Custom Docker runner with the security baselines in section 4.
- **LLM:** `ConstraintJudge` adapter using Gemini 1.5 Flash free tier; automated tests must use stubs or recorded fixtures.
- **Logging:** `pino` with request IDs; no `console.log` in `src/`.
- **Package Manager:** npm.
- _Enforcement:_ Do not introduce another language or package manager. Ask for explicit confirmation before adding, updating, or removing runtime dependencies or dev tooling not already present in `package.json`.

---

## 2. Core Commands

Run these commands to verify code changes. CI and local development use the exact same commands.

- Run single quality check (all-in-one): `npm run check`
- Lint code: `npm run lint`
- Format check: `npm run format:check`
- Type checking: `npm run typecheck`
- Run contract & unit tests: `npm test`
- Start local dev server: `npm run dev`
- Run database migrations: `npm run db:migrate`

---

## 3. Code Conventions

- **Architectural Flow:** Controllers handle HTTP transport and RFC 9457 formatting; Services execute domain logic and sandbox coordination; Repositories handle database persistence. Wire dependencies explicitly via constructor Dependency Injection.
- **API Errors:** All HTTP error responses MUST conform to **RFC 9457 (Problem Details for HTTP APIs)** with `type`, `title`, `status`, `detail`, and `instance`. Use `https://leettkob.dev/problems/<slug>` for `type`, with each slug declared in the endpoint contract. Do not return ad-hoc `{ code, message }` JSON objects.
- **Idempotency & Paging:** Mutation endpoints (e.g., submission uploads, publishing marks) must respect idempotency keys, persisted in PostgreSQL with a unique index and handled in the repository. List/queue endpoints must implement cursor-based pagination.
- **Exports & Functions:** Use named exports exclusively. No default exports. The only exception is a tool config file that the tool loads by default export (e.g. `eslint.config.js`).
- **Clean Logging:** No `console.log` statements inside the `src/` directory. Use a structured logger or clean output streams.
- **AI-LOG.md:** When adding an entry, place it at the top so the newest log appears first.
- **Git & Commit Conventions:** All commit messages must follow Conventional Commits: `<type>(<scope>): <summary>`. Types: `feat`, `fix`, `test`, `ci`, `docs`, `chore`, `refactor`. Scopes: `contract`, `submissions`, `sandbox`, `auth`, `rules`. Maximum 72 characters, imperative present tense, no period at end.
- **Branch Naming:** Feature branches must use `feat/*`, `test/*`, `fix/*`, or `gate/*`. Never commit directly to protected branch `main`.
- **Deliberate Breaks:** Keep intentional lint/test failures only on `gate/*` branches. A lint-breaking line intended for `gate/ci-test` landed on `main` in commit `cfcb089` (`src/app.js`); check `git branch --show-current` before committing a deliberate failure.
- **Verify Claims:** Open a file or workflow before claiming it exists or works. The 2026-10-30 AI-LOG entry said `.github/workflows/ci.yml` was added, but the committed workflow is empty; verify CI steps are executable and able to fail.

---

## 4. The "Never" List (LeeTKOB Strict Prohibitions)

- **NEVER leak secrets to Sandbox:** Never expose the LLM model API key, database credentials, or `.env` secrets inside the execution sandbox container, its filesystem, or its environment variables.
- **NEVER call real LLM models in unit/contract tests:** Always mock or stub external model API invocations in CI and automated test suites. Zero network calls to model providers during test runs.
- **NEVER call live models from automated evals:** Eval runs in CI must replay recorded fixtures; live model runs are manual commands only.
- **NEVER tamper with tests or evaluation data:** Never modify test files, dev set cases, labels, or thresholds (`eval.mjs`) simply to make a failing CI check pass. Code must adapt to the test, not the reverse.
- **NEVER bypass sandbox security baselines:** Every sandbox run has no network access; limits on CPU time, wall time, memory, number of processes and output size; a non-root user; no host mounts and no Docker socket. Never relax any of these to make a submission or a test pass.
- **NEVER make CI steps silently pass:** Do not use `|| true`, `continue-on-error`, or an empty workflow to hide a failing or missing quality check.
- **NEVER push directly to `main` branch:** All changes must go through a pull request and pass required CI status checks before merging.
- **NEVER create generic commit messages:** Messages like "update code", "fix bug", or "ai changes" are strictly forbidden. Always state the exact scope and intent.

## 5. Permission Boundaries (Three Tiers of Action)

Tier 3 overrides Tier 1 and Tier 2.

Your autonomous capabilities are strictly categorized into three tiers.

### Tier 1: Run Freely (No permission needed)

You may execute these read-only or easily reversible actions autonomously:

- Read files, `grep`, and search codebase.
- Run `npm run check`, `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm test`.
- Check git status (`git status`, `git diff`).
- Start the local dev server.

### Tier 2: Ask First (Requires explicit user confirmation)

You MUST pause and ask for my approval before executing:

- Pushing to remote (`git push`) or opening a Pull Request.
- Adding, updating, or removing a runtime dependency, or dev tooling not already present in `package.json`.
- Writing a new database migration file.
- Modifying CI/CD configuration files.

### Tier 3: Never the Agent (I will type this myself)

Under NO circumstances are you allowed to:

- Run a migration on the production database.
- Trigger a deploy or rollback.
- Delete database records, drop tables, or rotate API keys.
- Trigger emails or charge real users.
- Read, print or edit `.env`, or copy any secret value into code, a commit, a log, a chat or `AI-LOG.md`.
- Change the model provider's spending cap or billing settings.
