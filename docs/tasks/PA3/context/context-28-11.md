# Context PA#3 — 28/11/2026

## 1. Hoàn thành Task T22 — Cập nhật `PA3.md`, `README.md` & Link Video E2E (`@Dương`)

- **`PA3.md`:** Cập nhật link video demo E2E (Google Drive) vào Mục 5 (`End-to-End Screen Recording`), hoàn thiện đủ 5 mục bắt buộc của bài nộp PA#3 (chờ gắn tag `pa3` ở `T24` để điền nốt link GitHub Actions CI run).
- **`docs/tasks/PA3/submission/E2E-record-link.md`:** Đồng bộ link video Google Drive.
- **`README.md`:** Đã có đủ lệnh build/chạy CLI checker (`MODEL_OFF=1`), model `ag/gemini-3.8-flash` qua `9router`, và phép tính chi phí 1 lab 80 bài nộp.
- **`docs/tasks/PA3/task/checklist.md`:** Đánh dấu `[x] T22`.

## 2. Chạy 9router trên VPS cạnh worker (`@Thế Vinh`, với Claude Code)

- **Vấn đề:** 9router chỉ chạy trên máy Thế Vinh (`127.0.0.1:20128`), nên worker trên VPS không gọi được model và tự lùi về chỉ hard rules.
- **`docker-compose.yml`:** thêm service `9router` (image `decolua/9router:0.5.104`, cùng bản đang chạy ở máy local) với volume `9router-data`. Dashboard chỉ bind `127.0.0.1:20128` của VPS, mở qua SSH tunnel, Caddy không proxy. Worker gọi qua mạng Docker: `LLM_BASE_URL=http://9router:20128/v1`. Sandbox vẫn `--network none` nên không chạm được 9router.
- **`.gitignore`:** thêm `vps/`, vì thư mục này chứa `azure-vm-key.pem` (khóa SSH của VPS) mà trước đó chưa bị ignore.
- **Kiểm tra:** `docker compose config -q` hợp lệ. Chưa chạy trên VPS; việc deploy và sửa `.env` trên VPS do người làm (Tier 3).

## 3. Mật khẩu dashboard 9router trên VPS (`@Thế Vinh`, với Claude Code)

- **Vấn đề:** 9router từ chối đăng nhập bằng mật khẩu mặc định `123456` khi request đến từ xa (qua SSH tunnel và Docker), nên không vào được dashboard trên VPS.
- **`docker-compose.yml`:** service `9router` nhận `INITIAL_PASSWORD` và `JWT_SECRET` từ `NINEROUTER_PASSWORD` và `NINEROUTER_JWT_SECRET` trong `.env`. Thiếu một trong hai thì `docker compose` báo lỗi ngay, không lặng lẽ dùng mặc định.
- **`.env.example`:** thêm 2 biến trên, để trống.
- **Kiểm tra:** `docker compose config -q` hợp lệ khi có đủ biến, báo lỗi khi thiếu. Giá trị thật do Thế Vinh tự đặt trong `.env` trên VPS.

## 4. Sandbox mặc định 256 MB để compile `<bits/stdc++.h>` (`@Thế Vinh`, với Claude Code)

- **Phát hiện khi test e2e trên VPS:** bài nộp đúng có `#include <bits/stdc++.h>` bị chấm `compile-error`, worker không soát ràng buộc nào (`verdicts: 0`), review queue rỗng. Log sandbox: `g++: fatal error: Killed signal terminated program cc1plus`.
- **Nguyên nhân:** giới hạn bộ nhớ mặc định 64 MB. Đo trong sandbox local: 64 và 128 MB bị kill, 192 và 256 MB compile được. 8 bài trong dev set dùng `bits/stdc++.h`.
- **Test trước** (commit riêng): `tests/sandbox/sandbox-attacks.test.js` thêm test compile `<bits/stdc++.h>` với giới hạn mặc định; chạy với `SANDBOX_DOCKER=1` thì fail ở 64 MB.
- **Code:** `DEFAULT_LIMITS.memoryMb` trong `sandbox-runner.js` từ 64 lên 256. Vẫn có giới hạn bộ nhớ (`--memory == --memory-swap`); test M4 vẫn tự đặt 64 MB và vẫn bị OOM-kill.
- **Kiểm tra:** `SANDBOX_DOCKER=1 node --test tests/sandbox/sandbox-attacks.test.js` 21/21; `npm run check` pass.
- **Trên VPS:** cho tới khi deploy bản này, đặt `SANDBOX_MEMORY_MB=256` trong `.env` rồi `docker compose up -d worker`.
