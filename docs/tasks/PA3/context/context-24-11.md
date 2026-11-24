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
