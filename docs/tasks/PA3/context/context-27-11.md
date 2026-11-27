# Context PA#3 — 27/11/2026

## 1. Chuẩn bị hạ tầng Deploy Public (Task T20 Prep — `@Dương`)

- **Cấu hình Docker Stack cho VPS (tối ưu cho ổ đĩa 8 GB & chống Red-Team):**
  - `Dockerfile.app`: Multi-stage build từ `node:22-slim` (`npm ci --omit=dev --ignore-scripts && npm cache clean --force`):
    - Target `api`: chạy dưới user non-root `node`, khởi chạy `node src/server.js`.
    - Target `worker`: copy duy nhất binary tĩnh `docker` CLI từ `docker:27-cli` (tránh cài `docker.io` gây phình dung lượng), khởi chạy `node src/worker.js`.
  - `docker-compose.yml`: Điều phối 5 service (`postgres:16-alpine`, `migrate`, `api`, `worker`, `caddy:2-alpine`):
    - Cấu hình chung `x-logging` (`driver: json-file`, `max-size: '10m'`, `max-file: '3'`) áp dụng cho toàn bộ service để tránh tràn log trên VPS 8 GB khi bị spam/tấn công.
    - Tách quyền Docker socket: `api` **không** gắn `/var/run/docker.sock`; chỉ riêng `worker` mount `/var/run/docker.sock` để gọi `leetkob-sandbox`.
    - Dùng `env_file: [{ path: .env, required: false }]` để `docker compose config` hợp lệ cả khi chưa có `.env`.
    - Bổ sung `environment: { PUBLIC_DOMAIN: ${PUBLIC_DOMAIN:-localhost} }` cho riêng service `caddy` (và thêm `PUBLIC_DOMAIN=` vào `.env.example`) để Caddy nhận được domain thật xin HTTPS Let's Encrypt mà không bị lộ các biến bí mật (`JWT_SECRET`, `LLM_API_KEY`, `DATABASE_URL`) vào container proxy.
  - `Caddyfile`: Reverse proxy `{$PUBLIC_DOMAIN:localhost}` $\rightarrow$ `api:3000` (tự động cấp HTTPS Let's Encrypt khi triển khai trên VPS).
- **Xác minh:**
  - `npm run format && npm run check`: **232/232 tests pass**, ESLint/Prettier/`tsc --noEmit` xanh.
  - `docker compose config -q`: Hợp lệ (`docker-compose.yml valid`).
  - _(Chưa chạy `git commit` theo yêu cầu của người dùng)._

## 2. Tạo Script Seed PA#3 Idempotent (`scripts/seed-pa3.js` — `@Dương`)

- **Kiểm tra thực tế schema & auth:**
  - Bảng từ `migrations/`: `classes(id, name)`, `users(id, email, password_hash, role)`, `class_staff(class_id, user_id)`, `class_enrollments(class_id, student_id)`.
  - Hàm băm mật khẩu từ `src/modules/auth/service/passwords.js`: `hashPassword` dùng `node:crypto` `scrypt` (salt 16 bytes, key 64 bytes, format `scrypt$<saltHex>$<hashHex>`).
- **Cài đặt:**
  - `scripts/seed-pa3.js`: Kết nối `process.env.DATABASE_URL`, chạy transaction `BEGIN ... COMMIT`, idempotent (`ON CONFLICT DO NOTHING`) cho 2 lớp (`Class A`, `Class B`) và 5 tài khoản synthetic (`admin@leettkob.dev`, `ta1@leettkob.dev`, `ta2@leettkob.dev`, `student1@student.hcmus.edu.vn`, `student2@student.hcmus.edu.vn`), in bảng tài khoản + mật khẩu ra console.
  - `package.json`: Thêm `"db:seed": "node scripts/seed-pa3.js"`.
  - `Dockerfile.app`: Thêm `COPY scripts ./scripts` vào stage `api` để chạy được `npm run db:seed` trong container.
- **Xác minh:**
  - Chạy `npm run db:seed` **2 lần liên tiếp** trên PostgreSQL 18 đều thành công (2 classes, 5 users, 2 class_staff, 2 class_enrollments).
  - Chạy `npm run format && npm run check`: pass **232/232 tests**.

## 3. Nối `runInSandbox` vào `JudgeWorkerService` (`T07 + T09 + T11` — `@Dương`)

- `src/modules/grading/repository/judge-jobs.repository.{js,memory.js,postgres.js}`: Bổ sung `tests` của lab vào `JobSubmissionContext` trong `getSubmissionContext`.
- `src/modules/grading/service/judge-worker.service.js`, `src/container.js`, `src/worker.js`: Inject `sandboxRunner` (lấy `runInSandbox` ở `src/worker.js`) vào đầu `#evaluateDefault` — chạy tất cả test cases của lab trong container `leetkob-sandbox`; chỉ khi đạt `Accepted` mới chạy Hard Rules + LLM `ConstraintJudge`.
- `tests/grading/judge-worker.test.js`: Bổ sung 2 test kiểm chứng nhánh `Wrong Answer` bỏ qua Hard Rules/LLM và nhánh `Accepted` kích hoạt chấm ràng buộc.
