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
