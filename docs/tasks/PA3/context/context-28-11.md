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
