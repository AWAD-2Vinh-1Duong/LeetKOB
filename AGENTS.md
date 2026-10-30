# AGENTS.md — LeeTKOB Rules & Assistant Permissions

You are an AI programming assistant working on the LeeTKOB grading harness and platform. Read and strictly follow these rules before inspecting, suggesting, or modifying any code in this repository.

---

## 1. Example Stack
- **Runtime & Language:** Node.js (v22+)
- **Backend:** Express 5
- **Architecture:** Microservices/ 3-tier/ ???
- **Database:** PostgreSQL 16 (Access via pg / query builders; no heavy ORM bypasses)
- **Package Manager:** pnpm
- *Enforcement:* Never introduce new languages, alternative package managers (npm/yarn), or extraneous libraries without explicit user confirmation.

---

## 2. Core Commands
Run these commands to verify code changes. CI and local development use the exact same commands.
- Run single quality check (all-in-one): `pnpm check`
- Lint code: `pnpm lint`
- Format check: `pnpm format:check`
- Type checking: `pnpm typecheck`
- Run contract & unit tests: `pnpm test`
- Start local dev server: `pnpm dev`
- Run database migrations: `pnpm db:migrate`

---

## 3. Code Conventions
- **Architectural Flow:** . Controllers handle HTTP transport and RFC 9457 formatting; Services execute domain logic and sandbox coordination; Repositories handle database persistence. Wire dependencies explicitly via constructor Dependency Injection.
- **API Errors:** All HTTP error responses MUST conform to **RFC 9457 (Problem Details for HTTP APIs)** with `type`, `title`, `status`, `detail`, and `instance`. Do not return ad-hoc `{ code, message }` JSON objects.
- **Idempotency & Paging:** Mutation endpoints (e.g., submission uploads, publishing marks) must respect idempotency keys. List/queue endpoints must implement cursor-based pagination.
- **Exports & Functions:** Use named exports exclusively. No default exports.
- **Clean Logging:** No `console.log` statements inside the `src/` directory. Use a structured logger or clean output streams.
- **Git & Commit Conventions:** All commit messages must follow Conventional Commits: `<type>(<scope>): <summary>`. Types: `feat`, `fix`, `test`, `ci`, `docs`, `chore`, `refactor`. Scopes: `contract`, `submissions`, `sandbox`, `auth`, `rules`. Maximum 72 characters, imperative present tense, no period at end.
- **Branch Naming:** Feature branches must use `feat/*`, `test/*`, `fix/*`, or `gate/*`. Never commit directly to protected branch `main`.
---

## 4. The "Never" List (LeeTKOB Strict Prohibitions)
- **NEVER leak secrets to Sandbox:** Never expose the LLM model API key, database credentials, or `.env` secrets inside the execution sandbox container, its filesystem, or its environment variables.
- **NEVER call real LLM models in unit/contract tests:** Always mock or stub external model API invocations in CI and automated test suites. Zero network calls to model providers during test runs.
- **NEVER tamper with tests or evaluation data:** Never modify test files, dev set cases, labels, or thresholds (`eval.mjs`) simply to make a failing CI check pass. Code must adapt to the test, not the reverse.
- **NEVER bypass sandbox security bas
- **NEVER push directly to `main` branch:** All changes must go through a pull request and pass required CI status checks before merging.
- **NEVER create generic commit messages:** Messages like "update code", "fix bug", or "ai changes" are strictly forbidden. Always state the exact scope and intent.