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
  - `Caddyfile`: Reverse proxy `{$PUBLIC_DOMAIN:localhost}` $\rightarrow$ `api:3000` (tự động cấp HTTPS Let's Encrypt khi triển khai trên VPS).
- **Xác minh:**
  - `npm run format && npm run check`: **232/232 tests pass**, ESLint/Prettier/`tsc --noEmit` xanh.
  - `docker compose config -q`: Hợp lệ (`docker-compose.yml valid`).
  - _(Chưa chạy `git commit` theo yêu cầu của người dùng)._
