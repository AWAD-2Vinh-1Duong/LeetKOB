# Context PA#3 — 26/11/2026

## 1. Hoàn thành Task T05 — Job Queue trên PostgreSQL (`FOR UPDATE SKIP LOCKED`) & Worker tách biệt (`@Dương`)

- **Repository tầng dữ liệu hàng đợi & verdict (`src/modules/grading/repository/`):**
  - `judge-jobs.repository.js`: Định nghĩa JSDoc interface `JudgeJobsRepository` (`enqueue`, `claimNext`, `getSubmissionContext`, `completeJob`, `failJob`, `recordLlmCall`, `findVerdictsBySubmission`, `findJobsBySubmission`).
  - `judge-jobs.repository.memory.js`: Bản In-Memory phục vụ kiểm thử nhanh không cần DB.
  - `judge-jobs.repository.postgres.js`: Bản PostgreSQL thực tế sử dụng `SELECT ... FOR UPDATE SKIP LOCKED LIMIT 1` trong transaction để kéo job an toàn giữa nhiều worker song song; ghi `verdicts` theo cơ chế idempotent dùng khóa chính xác định `sha256(submissionId + '\0' + constraintId)` kèm `ON CONFLICT (id) DO NOTHING`, `deduction = 0`, `is_reviewed = FALSE`.
- **Ghi job đồng thời khi nộp bài (`POST /labs/:labId/submissions`):**
  - Cập nhật `PostgresSubmissionRepository.insertIfAbsent` chạy transaction `BEGIN ... COMMIT`: chèn `submissions` (`ON CONFLICT DO NOTHING`) và chèn 1 dòng `judge_jobs` (`status = 'queued'`) trong cùng giao dịch khi bài nộp mới được tạo.
  - Cập nhật `SubmissionService` gọi `judgeJobsRepository.enqueue(...)` (idempotent) khi có bài nộp mới.
- **Tiến trình Worker độc lập:**
  - `src/modules/grading/service/judge-worker.service.js` (`JudgeWorkerService`): Chạy pipeline chấm bài (Hard Rules AST trước → `ConstraintJudge` LLM hoặc fallback `unsure` khi `MODEL_OFF=1`), hỗ trợ `runOnce()`, `start()`, `stop()`, retry khi gặp lỗi tạm thời đến `max_attempts`, và luôn lưu verdict với `deduction: 0`, `is_reviewed: false`.
  - `src/worker.js` & `createWorkerContainer` trong `src/container.js`: Entrypoint tiến trình worker chạy độc lập với HTTP server (`npm run worker`), xử lý graceful shutdown (`SIGINT`/`SIGTERM`).
- **Kiểm thử tự động (`node:test`):**
  - `tests/grading/judge-worker.test.js` (5 test In-Memory): chứng minh nộp bài tạo 1 job, idempotent retry không tạo thêm job, luật `Q1` (dừng worker → nộp bài → bật worker → chỉ chấm 1 lần, 1 bộ verdict duy nhất, không trùng lặp khi lưu lại), 2 worker claim đồng thời, và cơ chế retry/fail.
  - `tests/grading/judge-worker-postgres.test.js` (2 test PostgreSQL thực tế): xác minh luật `Q1` và `FOR UPDATE SKIP LOCKED` trực tiếp trên PostgreSQL.
- **Xác minh Quality Gate:**
  - Chạy `npm run check` không có DB: **222/222 tests pass** (ESLint, Prettier, `tsc --noEmit`, `node:test`).
  - Chạy `npm run db:migrate && npm run check` trên PostgreSQL thật: **245/245 tests pass** (0 fail).

## 2. Hoàn thành Task T06 & T07 — 9 bài nộp C++ tấn công & Hardened Docker Sandbox (`@Dương`)

- **T06 (Test-first commit `724a87b`):**
  - Tạo 9 file tấn công `tests/sandbox/attacks/m1-network.cpp` → `m9-no-secrets.cpp` tương ứng 9 luật tối thiểu (`M1`–`M9`: network, CPU loop, wall-clock sleep, memory+swap read/write, fork bomb, stdout flood, non-root `geteuid()`, `/var/run/docker.sock` & `/etc/shadow`, `LLM_API_KEY` & `.env`).
  - Tạo `tests/sandbox/sandbox-attacks.test.js` kiểm tra đủ 9 vector tấn công trước khi cấu hình runner.
- **T07 (Hardened Docker Sandbox & CI):**
  - `Dockerfile.sandbox`: Image `alpine:3.20` + `g++`, user non-root `sandbox` (`UID/GID 10001`).
  - `src/modules/grading/service/sandbox-runner.js`: Biên dịch (`g++ -std=c++17 -O2`) và chạy bên trong container với `--network none`, `--read-only`, `--tmpfs /work:rw,exec,nosuid,nodev,size=64m,uid=10001,gid=10001`, `--user 10001:10001`, `--cap-drop ALL`, `--security-opt no-new-privileges:true`, `--memory == --memory-swap`, `--pids-limit`, `--ulimit cpu`, giới hạn output bytes, wall-clock `docker rm -f <containerName>`, không bind-mount host/`docker.sock`, và cô lập hoàn toàn biến môi trường (chỉ truyền `SANDBOX_*`, tuyệt đối không truyền `LLM_*` hay `DATABASE_URL`).
  - `.github/workflows/ci.yml`: Bổ sung trigger tag `pa3` và job `sandbox` build `Dockerfile.sandbox` rồi chạy `SANDBOX_DOCKER=1 node --test tests/sandbox/sandbox-attacks.test.js`.
- **Xác minh thực tế trên Docker:**
  - `SANDBOX_DOCKER=1 node --test tests/sandbox/sandbox-attacks.test.js`: **20/20 tests pass** (1 benign compile/run + 9/9 attack tests bị chặn đúng chuẩn + 10 unit/spec tests).
  - `npm run check`: **232/232 tests pass**.
