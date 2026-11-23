1. Complete Task T03 (Setup PostgreSQL 16, node-pg-migrate & PostgreSQL Repositories) - 00:15 - Assistant & Binh Duong

- Created database migration `migrations/1795453690243_init-schema.sql` defining 8 core tables: `users`, `classes`, `class_enrollments`, `labs`, `submissions`, `judge_jobs`, `verdicts`, `llm_call_logs` with required foreign keys and unique index `(student_id, lab_id, idempotency_key)`.
- Created `src/db.js` for PostgreSQL connection pool management via `pg`.
- Created `src/repositories/postgres.js` implementing `PostgresLabRepository` and `PostgresSubmissionRepository` retaining exact PA#2 interface contracts.
- Integrated `pino` logger into `src/app.js` with `x-request-id` header handling, request tracking, and centralized error logging.
- Created `tests/contract/post-labs-submissions-postgres.test.js` covering 100% of the submission contract scenarios on real PostgreSQL (43 tests total passing).
- Updated `docs/tasks/PA3/task/checklist.md` to mark `T03` complete.
- Created detailed verification report at `/home/harry/Documents/Course/advanced-web/final-project/personal/pa3/T03-report.md`.
