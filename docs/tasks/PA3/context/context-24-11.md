1. Complete Task T03 (Setup PostgreSQL 16, node-pg-migrate & PostgreSQL Repositories) - 00:15 - Assistant & Binh Duong

- Created database migration `migrations/1795453690243_init-schema.sql` defining 8 core tables: `users`, `classes`, `class_enrollments`, `labs`, `submissions`, `judge_jobs`, `verdicts`, `llm_call_logs` with required foreign keys and unique index `(student_id, lab_id, idempotency_key)`.
- Created `src/db.js` for PostgreSQL connection pool management via `pg`.
- Created `src/repositories/postgres.js` implementing `PostgresLabRepository` and `PostgresSubmissionRepository` retaining exact PA#2 interface contracts.
- Integrated `pino` logger into `src/app.js` with `x-request-id` header handling, request tracking, and centralized error logging.
- Created `tests/contract/post-labs-submissions-postgres.test.js` covering 100% of the submission contract scenarios on real PostgreSQL (43 tests total passing).
- Updated `docs/tasks/PA3/task/checklist.md` to mark `T03` complete.
- Created detailed verification report at `/home/harry/Documents/Course/advanced-web/final-project/personal/pa3/T03-report.md`.

2. Complete Tasks T10 and T11 (hard rules, ban-list constraints) - Quang Vinh with Claude Code

- Commit `c9004d5` first: `tests/rules/hard-rules.test.js`, 34 tests. They cover reading the constraint text, violations (qualified call, `using namespace std`, `using std::sort`, banned header, correct line numbers) and the traps that must not fire (line and block comments, string and raw string literals, own `sort` in a namespace or at global scope, `l.sort()` member call, `sort_heap`, `<algorithm>` used only for `std::swap`).
- Then `src/rules/cpp-tokens.js` (tokenizer that drops comments and literals and keeps line numbers) and `src/rules/hard-rules.js` (`parseBanList`, `checkBanList`, `decideConstraint`, `partitionConstraints`). No regex runs over student code. A decision carries no deduction and is marked `decidedBy: 'hard-rule'`.
- All 34 tests passed without editing any test after the first commit.
- Not done yet: wiring `partitionConstraints` into the worker so the model is skipped for decided constraints (needs T05 and T13), and running only for `Accepted` submissions (needs the sandbox).

3. Complete Task T08 (login with scrypt and JWT, class access) - Quang Vinh with Claude Code

- Contract first: `docs/contract/auth-and-lab-access.md` (login, who sees a lab, review queue access). Tests before code: `tests/auth/` (passwords, in-memory contract tests, PostgreSQL tests that skip without `DATABASE_URL`). Two later test-only commits fixed my own mistakes: a missing `tsc` type on the seeded roles, and a no-echo test whose password was the word "wrong", which the error message also contains. Neither loosened an assertion.
- Added `POST /auth/login` (zod body, salted `scrypt` hash, HS256 token with `sub`, `role`, `exp`, same 401 `invalid-credentials` for unknown email and wrong password, decoy hash so both take similar time), `GET /labs/:labId` and `GET /labs/:labId/review-queue`.
- A TA of another class and a student of another class get `404 lab-not-found`, identical to a missing lab. An enrolled student on the review queue gets `403 staff-only`. The queue itself returns `{ items: [] }`; its content is T16.
- New migration `migrations/1795540000000_class-staff.sql` (`class_staff`), asked and approved before writing. Applied to a throwaway `postgres:16` container: 79 tests pass there, 62 pass without a database.
- `npm test` now runs with `--test-concurrency=1` because the PostgreSQL test files truncate the same tables.
- Checked that the tests bite: with the TA check in `findForUser` removed, 3 tests fail.
- Not done: CI has no PostgreSQL service, so the PostgreSQL tests are skipped there. Users still have to be created by a seed or script; a registration or admin endpoint is not part of T08.

4. Complete Task T09 (TA creates a lab, student follows a submission) - Quang Vinh with Claude Code

- Contract first: `docs/contract/labs-and-submission-status.md`. Tests before code: `tests/labs/` (in-memory, 36 tests) and a PostgreSQL version that creates the lab through the API, with no row inserted by hand for it.
- Added `POST /labs` (TA of the class or admin; body validated with zod; constraints numbered `c1`, `c2`… by the server; the deduction is a number the TA types), `GET /labs/:labId` now returns title, statement, constraints, and the tests for staff only, and `GET /submissions/:id`, which the `Location` header of a submission already pointed to.
- `GET /submissions/:id` returns only `id`, `labId`, `studentId`, `language`, `status`, `createdAt`. No source, verdict or deduction can reach a student here. Another student, or a TA of another class, gets `404 submission-not-found`.
- A TA of another class and a class that does not exist both get `404 class-not-found`.
- No new migration: `labs` already has `title`, `statement`, `tests` and `constraints` (JSONB).
- Checked that the tests bite: removing the "TA teaches the class" check and the "student owns the submission" check makes 3 tests fail. Both changes were restored.
- Verified on a throwaway `postgres:16` container: 153 tests pass there, and `npm run check` is green without a database.
- Not done: the student does not yet see a test result (`Accepted`, `Wrong Answer`, `TLE`); it needs the queue, worker and sandbox (T05 to T07). `status` stays `queued` until then. Lab creation does not use an `Idempotency-Key`; the contract does not require it for this endpoint.

5. Refactor the app into feature folders with a DI container - Quang Vinh with Claude Code

- Moved from layer folders (`controllers/`, `services/`, `repositories/`, `middlewares/`) to `src/auth`, `src/labs`, `src/submissions`, `src/shared`, each holding `<feature>.routes.js`, `.controller.js`, `.service.js` and one repository interface plus a PostgreSQL and an in-memory implementation. Files were moved with `git mv` first (commit `0996d35`), so history follows them.
- `src/container.js` is now the only place that builds repositories, services and controllers and chooses PostgreSQL or in-memory. `src/app.js` only builds Express: request context, routers, error handler. Routes moved to `*.routes.js` next to each controller.
- Logic left the controllers: `AuthService` (login, token), `LabService.getVisible` and `openReviewQueue`. `parseBody` in `shared/validation.js` replaced three copies of the zod error mapping. `assertStaff` in `auth/roles.js` holds the "students may not" rule.
- `npm run dev` pointed at `src/app.js`, which only exports a function, so it never started a server. Added `src/server.js` and `src/config.js` (reads `JWT_SECRET`, `DATABASE_URL`, `PORT`, `LOG_LEVEL`; refuses a short secret) and pointed `dev` at it. `tests/config.test.js` came first.
- ESLint now enforces the layers (`no-restricted-imports`): only the container imports a concrete repository, controllers never touch repositories, services never import `express` or `pg`, routes never import services. Checked with five deliberate violations, each one failed lint; they were reverted.
- Rules for the next people: `docs/architecture.md`, summarised in section 6 of `AGENTS.md`.
- The only changes to existing tests were import paths (repository files, `shared/db.js`); no assertion was touched. 139 tests pass without a database, 160 on a throwaway PostgreSQL 16.
- Not done: `ci.yml` still has no PostgreSQL service and still runs only for pull requests into `main`.

6. Fix submission check order and organise modules and middleware - Quang Vinh with Codex

- Recorded the baseline on Node 22 with `DATABASE_URL` unset. All 139 tests passed.
- Added two contract tests for staff submissions. Before the fix, the TA's malformed JSON returned 400 and the admin's oversized JSON returned 413. Moved the student role check before JSON parsing and verified that both requests now return the RFC 9457 `403 forbidden-role` response. The suite reached 141 passing tests.
- Used `git mv` to put auth, labs and submissions under `src/modules/` with controller, service and repository folders, and grading under its service folder. Moved the grading test and the HTTP middleware files, updated imports and verified that all 141 test names were preserved.
- Moved JWT verification to the auth token helper and the Idempotency-Key check to middleware. Kept lab visibility ahead of the staff check for the review queue. Added five middleware tests covering successful requests and RFC 9457 errors. All 146 tests passed.
- Added an ESLint import restriction for middleware. A temporary import of the lab service triggered `no-restricted-imports`. Removed the import and verified that lint passed again.
- Updated the layout, request flow and feature checklist in `docs/architecture.md`, the layout and dev command in `AGENTS.md`, and the source tree in `README.md`. Drafted the AI log entry.
