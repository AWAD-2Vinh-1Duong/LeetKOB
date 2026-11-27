# AI Log

Khi ghi AI Log thì phải ghi ở trên cùng.

## 2026-11-26 — Hardened Docker Sandbox & 9 Attack Submissions (PA#3 T06 & T07, Dương)

Tool: Antigravity
Asked for: Tasks T06 and T07 — write and commit 9 C++ attack submissions (`M1`–`M9`) before configuring the runner, build a hardened Docker sandbox (`Dockerfile.sandbox`, `src/modules/grading/service/sandbox-runner.js`) enforcing all 9 security minimums (compile inside sandbox, `--network none`, CPU/wall/memory+swap/pids/output limits, non-root UID 10001, `--read-only` rootfs with no host mounts or `docker.sock`, stripped environment passing only `SANDBOX_*`), and wire the 9-attack suite into `.github/workflows/ci.yml` on PRs and tag `pa3`.
Kept: Test-first commit `724a87b` (`test(sandbox): add 9 minimum security attack submissions`); Alpine 3.20 + `g++` sandbox image (`USER 10001:10001`); stdin base64 source/input transport eliminating host bind mounts; container-level wall-clock kill (`docker rm -f`); verified 20/20 sandbox tests passing against real Docker (`SANDBOX_DOCKER=1`) and 232/232 tests in `npm run check`.
Changed: Added `uid=10001,gid=10001` and `TMPDIR=/work` to `--tmpfs /work` so non-root `g++` compilation works under `--read-only`; used `--ulimit cpu=<s:s>` with duration disambiguation for `exitCode 137` (`cpu-limit` vs `memory-limit`) because Alpine PID 1 masks `SIGXCPU`.
Rejected: Bind-mounting a host temp directory (`-v`) into the sandbox container (violates `M8` no-host-mount rule).

## 2026-11-26 — PostgreSQL Job Queue (`FOR UPDATE SKIP LOCKED`) & Isolated Worker (PA#3 T05, Dương)

Tool: Antigravity
Asked for: Task T05 — Enqueue a job in `judge_jobs` atomically when `POST /labs/:labId/submissions` returns `202 Accepted`, build an isolated background worker process pulling jobs with PostgreSQL `FOR UPDATE SKIP LOCKED`, guarantee idempotent verdict persistence for Law `Q1` (stop worker -> submit -> start worker -> graded once with 1 unique set of unreviewed verdicts), and add `node:test` coverage for both in-memory and PostgreSQL.
Kept: Modular layout (`src/modules/grading/repository/judge-jobs.repository.{js,memory.js,postgres.js}`, `src/modules/grading/service/judge-worker.service.js`, `src/worker.js`, `createWorkerContainer` in `src/container.js`); transactional `INSERT INTO submissions` + `INSERT INTO judge_jobs` in `PostgresSubmissionRepository.insertIfAbsent`; deterministic SHA-256 verdict IDs (`(submission_id, constraint_id)`) with `ON CONFLICT (id) DO NOTHING`, `deduction = 0`, `is_reviewed = FALSE`; verified 245/245 tests passing against real PostgreSQL 18 (`npm run db:migrate && npm run check`) and 222/222 tests without DB.
Changed: Replaced initial single-statement data-modifying CTE for `submissions` + `judge_jobs` with an explicit PostgreSQL transaction (`BEGIN`/`COMMIT`) after real PostgreSQL tests caught FK snapshot visibility errors, and added explicit SQL type casts (`::varchar`, `::timestamptz`) in `PostgresJudgeJobsRepository.enqueue`.
Rejected: Adding a new database migration (Tier 2) — reused the existing `judge_jobs` and `verdicts` tables from `1795453690243_init-schema.sql` with deterministic 64-char primary keys on `verdicts(id)`.

## 2026-11-25 — Guardrails, checker command, 9router model and dev-set run (PA#3, Thế Vinh)

Tool: Claude Code (Claude Opus 5.5)
Asked for: T12, T14, T15, T17, T18, T13 and T19: strip comments and identity, schema and timeout guardrails tested with a fake model, the checker command with `MODEL_OFF=1` and its Docker image, our own eval cases, Gemini 3.8 Flash through 9router, and the real dev-set run with its cost per lab.
Kept: Tests before code for every part (`sanitize`, `constraint-judge`, `checker`, `custom-cases`, `openai-compatible-model`); `ConstraintJudge` turns every schema failure, model error and time-out into `unsure` with `decidedBy: 'guardrail'`; the checker works from `statement.md` and `constraints.json` alone and gives 0 wrongful deductions with the model off; the real run on the dev set (`docs/tasks/PA3/submission/dev-run/`) gives wrongful 0, recall 94.6% (35/37), unsure 1.0%.
Model and cost: `ag/gemini-3.8-flash` through 9router, a free provider ($0 cap, no payment method). Measured on the dev set: 47 submissions, 39 calls, 117,330 input and 1,906 output tokens, so 2,496.4 input and 40.6 output tokens per submission. One lab of 80 submissions ≈ 80 × 2,496.4 = 199,711 input and 80 × 40.6 = 3,244 output tokens; cost = 199,711 × 0 / 10⁶ + 3,244 × 0 / 10⁶ = $0.
Changed: Asked to move from Gemini 3.6 to `ag/gemini-3.8-flash` via 9router and fix every doc saying 3.6; removed the AI's `Co-Authored-By` trailer from commits; the dev-set test exposed 2 wrongful deductions (own `sort`/`gcd` under `using namespace std`), fixed in `hard-rules.js` after trap tests; fixed JWT verify using the wall clock instead of the injected clock.
Rejected: Pasting the API key into chat or the terminal (kept only in `.env`, edited by hand); fixing the `reverse-words/s05` hard-rule miss (left to the T11 owner); rewriting the applied migration's default model; a per-lab cost cap, since the provider is free ($0).

## 2026-11-24 — Architecture, refactor prompts, Prisma check, review and PR #16 (Quang Vinh)

Tool: Claude Code (Claude Opus 5.5)

Asked for, in order:

1. Read the project and suggest an architecture with clearer module boundaries.
2. Read the brief and the rubrics, and compare "layers first" with "modules first" and with clean architecture.
3. Put middleware in its own folder.
4. Write a prompt so a smaller model (Codex) could do the refactor.
5. Name the architecture.
6. Use Prisma for database access: does it work with plain JavaScript, which ORMs JavaScript usually uses, and why Prisma lacks some SQL statements.
7. Write a second prompt for the Prisma switch.
8. Check Codex's result.
9. Write the AI log, push the branch and open a pull request into `dev`.

Kept:

- **Architecture choice.** A modular monolith: `src/modules/<module>/{controller,service,repository}/`, with HTTP middleware in `src/middlewares/`, and ports and adapters for the coming `grading` module. The reason comes from the rubric. PA3 criterion 2 needs a separate worker, and criterion 6 needs a CLI checker that "works from `statement.md` and `constraints.json` alone" with `MODEL_OFF=1`. So the hard rules, the `ConstraintJudge` and the guardrails must not depend on Express or `pg`.
- **The contract bug.** Calling the app showed that a TA with malformed JSON got 400 and an admin with a 300 KB body got 413. The "Order of checks" in `post-labs-submissions.md` requires `403 forbidden-role` first. No existing test sent a staff token with a bad body.
- **The refactor prompt**, in four phases: a red test commit, the fix, `git mv` moves, then middleware extraction with an ESLint rule and docs. It gave a file-by-file move table, a 139-test baseline and stop conditions. Codex ran it (`b154004` to `e90f102`).
- **The Prisma check.** A scratch project on Node 22.22.3 with Prisma 7.10.1 and a throwaway PostgreSQL 16 showed:
  - the generated `.ts` client runs from `.js` with no build step;
  - `tsc` needs `allowImportingTsExtensions`;
  - `prisma.config.mjs` works, but only with `process.env.DATABASE_URL`, because the `env()` helper makes `prisma generate` fail without a database;
  - `new PrismaPg(pool)` reuses our `pg.Pool`;
  - `createManyAndReturn({ skipDuplicates: true })` emits `ON CONFLICT DO NOTHING RETURNING`;
  - `FOR UPDATE SKIP LOCKED` works through `$queryRaw` in `$transaction`.

  The Prisma prompt (generate from the existing schema, then move one repository at a time, then lint and docs) is written but has not been run.

- **The review of Codex's six commits** (details in the Codex entry below), then pull request #16 from `feat/module-layout` into `dev`.

Changed:

- Claude's first layout put `auth.middleware.js` inside `modules/auth/controller/`. Quang Vinh asked for middleware in its own folder, so the design and the prompt were rewritten around `src/middlewares/`.
- Claude said Prisma had no equivalent of `ON CONFLICT DO NOTHING RETURNING`, and could not confirm that Prisma 7 runs in plain JavaScript. Quang Vinh questioned both, and asked whether Prisma only supports TypeScript. The scratch project proved both claims wrong, and the answers were corrected.
- Claude's first AI-log edit put a `Rejected:` line right after a bullet list. Prettier then indented it into the last bullet. It was rewritten without the list.

Rejected:

- Going back to folders by layer (`src/controllers/`, `src/services/`, `src/repositories/`). It would undo `0996d35` and spread each feature over three places.
- Using `requireRole` on the review queue. It would answer 403 before the 404 that `auth-and-lab-access.md` requires, and so reveal that a lab exists.
- Kysely, offered as an alternative to Prisma. Quang Vinh kept the Prisma plan.
- Switching to Prisma before PA3. It is postponed because of the deadline, the Tier 2 approval for the new dependencies, and the queue being built on `pg`. Bình Dương's T03 entry also rejected Prisma under `AGENTS.md`, so the team must agree first.
- A bare `npm i prisma`. npm's `latest` tag pointed at `8.0.0-rc.35`, so the prompt pins 7.10.1.

## 2026-11-24 — Submission check order and module layout (Quang Vinh)

Tool: Codex
Asked for: Fix the submission contract bug, move features into module layers, extract HTTP middleware, enforce layer boundaries with ESLint and update the architecture documentation.
Kept: Two contract regressions for 403 precedence, the module and middleware layout, five middleware tests, and the lint boundary verified with a temporary lab service import. The suite increased from 139 to 146 passing tests with `DATABASE_URL` unset.
Changed: No code was changed after review. Before the pull request, Claude Code checked the six commits (`b154004` to `e90f102`). It ran `npm run check` on each commit in a separate worktree: `b154004` failed only on its two new tests, and every later commit was green. On a throwaway PostgreSQL 16, 167 of 167 tests passed, against 160 of 160 before the refactor. The test diff held only the new tests and import paths. Probe imports showed that the new ESLint block stops services, repositories, controllers and `pg` in middleware.
Rejected: Nothing was reverted. Left for a follow-up: lint does not yet stop a controller or a service from importing `src/middlewares/`; `POST /labs` and `POST /auth/login` still call `express.json` directly instead of `jsonBody`; `src/container.js` and `src/shared/db.js` still read `process.env`.

## 2026-11-24 — Cài đặt PostgreSQL 16, node-pg-migrate và PostgreSQL Repositories (Bình Dương)

Tool: Antigravity Agent
Asked for: Thực hiện Task T03 trong checklist: Cài đặt các bảng cơ sở dữ liệu qua `node-pg-migrate`, cài đặt PostgreSQL repositories cho `labs` và `submissions`, tích hợp `pino` logger với `request-id`, và đảm bảo toàn bộ contract tests pass trên PostgreSQL.
Kept: Migration SQL `migrations/1795453690243_init-schema.sql` tạo đủ 8 bảng (`users`, `classes`, `class_enrollments`, `labs`, `submissions`, `judge_jobs`, `verdicts`, `llm_call_logs`) kèm index và unique index `(student_id, lab_id, idempotency_key)`. Tạo `src/db.js` và `src/repositories/postgres.js` với `PostgresLabRepository` và `PostgresSubmissionRepository` chuẩn interface. Tích hợp `pino` logger vào `src/app.js` tự động gắn `req.id` và child logger. Viết test `tests/contract/post-labs-submissions-postgres.test.js` kiểm tra toàn bộ contract trên PostgreSQL thực tế.
Changed: Cấu hình test contract postgres tự động skip khi không có biến `DATABASE_URL` để đảm bảo lệnh `npm run check` trên môi trường CI (chưa bật container DB) vẫn xanh 100%, đồng thời chạy đầy đủ 43 tests khi có `DATABASE_URL`.
Rejected: Không dùng ORM nặng (Prisma, TypeORM) theo đúng quy tắc kiến trúc `AGENTS.md` (chỉ dùng `pg` và plain SQL).

## 2026-11-21 — Sửa lỗi Prettier format cho toàn bộ tài liệu PA#3 (Bình Dương)

Tool: Antigravity Agent
Asked for: Sửa lỗi Prettier (`npm run format:check`) báo đỏ trên CI workflow cho 11 file Markdown và tài liệu.
Kept: Cập nhật `.prettierignore` để bỏ qua các file tài liệu rubric đề bài môn học từ Classroom theo đúng quy định. Chạy `npm run format` định dạng lại toàn bộ 11 file và xác minh `npm run check` xanh 100%.
Changed: No
Rejected: No

## 2026-11-21 — Cập nhật AGENTS.md, .env.example và scripts cho PA#3 (Bình Dương)

Tool: Antigravity Agent
Asked for: Thực hiện Task T02 trong checklist: Cập nhật `AGENTS.md` bổ sung các quy tắc Never của PA#3 theo rubric Catching your assistant, cập nhật `.env.example`, thêm `npm run dev` và `npm run db:migrate` vào `package.json`.
Kept: Danh sách cấm (Never) đặc thù PA#3: cấm mount docker socket, cấm `--privileged`, cấm truyền secret (`LLM_API_KEY`) vào sandbox container, cấm test cấp phát bộ nhớ mà không đọc lại (tránh tối ưu hóa compiler), cấm sửa dev set/eval script, cấm hardcode ID dev set trong rules/prompts, cấm bypass TA review queue. Cập nhật `.env.example` đầy đủ biến và giữ trống giá trị. Thêm script `dev` và `db:migrate` vào `package.json`.
Changed: Giữ `MODEL_OFF=` trong `.env.example` để hỗ trợ switch đánh giá chuẩn theo yêu cầu Tiêu chí 6 rubric. Cập nhật mục Stack và Commands của `AGENTS.md` phản ánh trạng thái kích hoạt của PA#3.
Rejected: Không truyền bất kỳ giá trị secret thật nào vào file mẫu; không gán giá trị mặc định cho `.env.example`.

## 2026-11-21 — Thiết lập không gian nộp bài PA#3 (Bình Dương)

Tool: Antigravity Agent
Asked for: Thiết lập không gian làm việc `docs/tasks/PA3/submission/` với các mẫu sẵn sàng điền (`PA3.md`, `SELF_ASSESSMENT_REPORT.md`, `dev-run/.gitkeep`), bảng kiểm tra trước khi nộp (`submission-note.txt`), và cập nhật `.prettierignore` để đảm bảo quy trình kiểm tra chất lượng đồng nhất.
Kept: Cấu trúc 8 tiêu chí chấm điểm của PA#3 (tổng 100 điểm), 9 luật tối thiểu của sandbox (`M1`–`M9`), bảng 5 tài khoản test giả lập, các lệnh CLI checker với cờ `MODEL_OFF=1`, thư mục lưu trữ kết quả chạy dev set, và bảng kiểm tra plain-text nhấn mạnh quy tắc điểm liệt (Syllabus rule) và cơ chế Human Gate.
Changed: Lưu các bản mẫu trực tiếp trong `docs/tasks/PA3/submission/` kèm quy tắc đồng bộ bắt buộc ra thư mục gốc (`PA3.md` và `SELF_ASSESSMENT_REPORT.md`) trước khi gắn tag `pa3` và nén file `.zip`. Thêm `docs/tasks/PA3/submission/dev-run/**` và `submission-note.txt` vào `.prettierignore` để tránh lỗi định dạng dữ liệu raw/plain text.
Rejected: Tuyệt đối không lưu API key hay tài khoản thật vào bất kỳ file template nào; không điền sẵn điểm số tự chấm mà dùng các placeholder `<TODO: ...>` để nhóm tự đánh giá trung thực khi hoàn thiện từng tiêu chí.

## 2026-11-08 — Kiểm tra bài nộp PA#2 và sửa minh chứng (Quang Vinh)

Tool: Claude Code (Claude Opus 5.5)
Asked for: Audit the PA#2 submission folder against the rubric, then fix every problem found.
Kept: Corrected `PA2.md` links (the commit and run that turned PR #6 green; the tag-run list instead of a run on the tag's earlier commit), `.gitleaksignore` for one false positive, the missing 2026-10-31 AI-LOG entry and the `2026-29-10` date fixes. A contract test for `500 internal-error`, confirmed to fail when the error handler leaks the error message. PR #10, which re-proves the gate after `quality` became required: red, merge blocked, then green.
Changed: The audit found that `main` required no status check, although `SELF_ASSESSMENT_REPORT.md` said the team confirmed it did: the API returned `"contexts": []` and our own screenshot read "No required checks". We added `quality` as a required check and replaced the claim with the new screenshot. The model was changed from Gemini 1.5 Flash, shut down by Google in September 2025, to Gemini 3.6 Flash. `AGENTS.md` listed `npm run dev` and `npm run db:migrate`, which do not exist in `package.json`; they were moved to a "planned for PA#3" note, and stack items not installed yet were marked _(PA#3)_. The README's spending-cap line was rewritten from "no cap" to the 0 USD cap the provider enforces on a project without billing. `AGENTS.md` was cut from 101 to 48 lines by merging duplicate rules, keeping every LeeTKOB Never line and both incident-backed rules. `.env.example` listed the API key twice (`LLM_API_KEY` and `GEMINI_API_KEY`); only `LLM_API_KEY` remains.
Rejected: An API key pasted into the chat to test which models it can call. Tier 3 of `AGENTS.md` forbids putting a secret in a chat or a command, so the assistant gave a command that reads the key from `.env` instead, and the key is to be rotated. Rejected a README line saying a refused model call becomes an `unsure` verdict: that is a PA#3 design decision the team has not made.

## 2026-11-07 — Bật CI cho tag pa2

Tool: GitHub Copilot
Asked for: Cấu hình workflow hiện tại để quality job cũng chạy khi tag pa2 được push.
Kept: Giữ trigger pull request và quality job hiện có; thêm trigger push cho tag pa2.
Changed: No
Rejected: No

## 2026-11-07 — Cập nhật mô tả Free tier trong README

Tool: GitHub Copilot
Asked for: Sửa README để mô tả đúng việc chỉ sử dụng Gemini Free tier và chưa bật billing/spending cap.
Kept: Ghi rõ khoản trả trước 800.000 VNĐ theo thông tin nhóm cung cấp, trạng thái billing chưa bật, và quota Free tier.
Changed: No
Rejected: No

## 2026-11-07 — Cập nhật self-assessment theo xác nhận của nhóm

Tool: GitHub Copilot
Asked for: Cập nhật điểm và minh chứng self-assessment theo giải thích của nhóm về branch protection, Free tier và tag pa2.
Kept: Ghi nhận run 41223080718 là xanh theo xác nhận của nhóm; ghi rõ Free tier được giữ để tránh khoản trả trước 800.000 VNĐ.
Changed: No
Rejected: No

---

## 2026-11-07 — Hoàn thiện self-assessment PA#2

Tool: GitHub Copilot
Asked for: Điền báo cáo self-assessment PA#2 theo rubric, dùng minh chứng có thật và đánh dấu phần chưa xác minh.
Kept: Dùng điểm và liên kết dựa trên nội dung hiện có trong repository; để placeholder cho minh chứng còn thiếu hoặc mâu thuẫn.
Changed: No
Rejected: No

## 2026-11-01 — Contract và contract tests cho POST /labs/{labId}/submissions (PA#2, Thế Vinh)

Tool: Claude Code (Claude Opus 5.5)
Asked for: Write the contract for `POST /labs/{labId}/submissions`, contract tests that assert the RFC 9457 body, the minimal code to pass them, and a deliberate break on a `gate/*` branch.
Kept: The contract (role, enrollment ownership with 404, idempotency scope per student and lab, 9 problem types, order of checks), 31 tests in `tests/contract/`, and the in-memory repository behind constructor DI, marked `shortcut:` until PA#3.
Changed: No
Rejected: No

## 2026-10-31 — Sửa lỗi định dạng tài liệu CI - Dương

Tool: GitHub Copilot
Asked for: Fix the Prettier failures reported for `docs/tasks/PA#2/checklist.md` and `PA2.md` in the CI run.
Kept: Ran Prettier on the two reported files and confirmed the full `npm run check` passes.
Changed: No
Rejected: No

## 2026-10-31 — Thiết lập và kiểm chứng CI (PA#2 - Dương)

Tool: GitHub Copilot
Asked for: Complete the CI and branch-protection tasks in Giai đoạn 4 and verify a deliberate red-to-green pull request.
Kept: Added the pull-request workflow and verified PR #6 failed on the deliberate lint error, then passed after the fix.
Changed: No
Rejected: No

## 2026-10-31 — Cập nhật luật Agent và README (PA#2, Bình Dương)

Tool: GitHub Copilot
Asked for: Update `AGENTS.md` from the PA#2 review and document Gemini 1.5 Flash free tier with a 1 USD/month cap in `README.md`.
Kept: Chose the concrete stack from the review and applied its CI, eval, RFC 9457, and idempotency recommendations.
Changed: No
Rejected: No

## 2026-10-31 — Review AGENTS.md and choose the tech stack (PA#2, Thế Vinh)

Tool: DeepSeek V4.1 Flash Free (OpenCode)
Asked for: Review the AGENTS.md draft against the PA#2 rubric and propose a tech stack with reasons.
Kept: The three permission tiers, the completed sandbox never line and npm as the package manager — all match the rubric, so they were left untouched.
Changed: Wrote the review as a separate file instead of editing AGENTS.md, which is Quang Vinh's deliverable. In that file, replaced the "Example Stack / Microservices / 3-tier / ???" placeholder with a concrete stack, and chose JavaScript + checkJs over TypeScript because package.json, tsconfig.json and the test glob are already wired for it.
Rejected: Rejected rewriting AGENTS.md directly. Rejected treating the 0-byte ci.yml as a gate: an empty workflow always passes, the exact case rubric 7 warns about. Rejected Redis, Prisma, Jest and Judge0 — reasons in the stack table.

## 2026-10-31 — CLAUDE.md, secrets và công cụ kiểm tra (PA#2, Quang Vinh)

Tool: Claude Code (Claude Opus 5.5)
Asked for: Write `CLAUDE.md`, then complete Giai đoạn 2 (`.env.example`, permission tiers, secret scan) and Giai đoạn 3 (lint, format, type check and one `npm run check` command).
Kept: `CLAUDE.md` importing `@AGENTS.md`; ESLint 10, Prettier 3, `tsc --noEmit` with `checkJs` and `node --test` chained in `npm run check`; `.env.example` with every value empty; a gitleaks scan of the whole history.
Changed: The first `CLAUDE.md` the assistant wrote failed `prettier --check`; it was reformatted and "Format before committing" became a rule in `CLAUDE.md`. `README.md` said a spending cap "Đã thiết lập" although none existed; that line was changed to a TODO.
Rejected: `npm audit fix --force`, which would have downgraded ESLint 10 to 4 to silence a dev-only `minimatch` advisory. Rejected treating `npm test` as a gate while `tests/` was empty: `node --test` exits 0 when it finds no test files, so the step could not fail until contract tests existed.

## 2026-10-30 — Thiết lập CI chặn merge

Tool: GitHub Copilot
Asked for: Thiết lập workflow CI cho pull request, chuẩn bị nhánh thử lint/format đỏ và chuyển các lệnh hướng dẫn từ pnpm sang npm.
Kept: Dùng `npm run check` làm lệnh kiểm tra duy nhất trong workflow theo hướng dẫn tại `AGENTS.md`.
Changed: Đổi các lệnh trong `AGENTS.md` và `README.md` sang npm; thêm workflow `.github/workflows/ci.yml`; tạo nhánh `gate/ci-test` và thêm đoạn mã cố ý vi phạm lint/format vào `src/app.js`.
Rejected: Không thêm `package.json`, script kiểm tra hay cấu hình lint/format vì nằm ngoài phạm vi bước được yêu cầu. `npm run check` hiện không chạy được do repository chưa có `package.json`; chưa có PR hoặc ảnh CI vì chưa commit/push.

## 2026-10-29 - Adjust the AGENTS.md (PA#2, Bình Dương)

Tool: Gemini 4 Argon - Medium
Asked for: Adjusting the content of the AGENTS.md which is generated before (in session 3, including 4 parts: Stack, Commands, Conventions, và Never)
Kept: Kept all the content, excluding the "stack" which is need to be further researched and disscused with team
Changed: Adjust the "stack" to "example stack"
Rejected: Didn't reject any content

## 2026-10-29 - Tạo file quản lý công việc (PA#2, Bình Dương)

Tool: Gemini 3.1 Pro - Medium
Asked for: Based on the Rubric and Requirement file, create a checklist.md includes all the tasks which are needed to completed for PA#2
Kept: Keeping the content of checklist which is generated
Changed: adjust some task status from "not done" ([ ]) to "done ([x])
Rejected: Didn't reject any content

## 2026-10-29 - Tạo cấu trúc file (PA#2, Bình Dương)

Tool: MAI Code 1.1 FLASH (Auto copilot)
Asked for: Setting up the file structure for the repository (includes AI's rules files, /src, /docs, /tests, ...)
Kept: Use the structure which given by AI
Changed: add some rules file such as: "AGENTS.md", "CLAUDE.md", ".github/copilot-instructions.md"
Rejected: Didn't reject any content
