# LeeTKOB — Grading Harness & Quality Gate

LeeTKOB là nền tảng hỗ trợ Trợ giảng (TA) chấm bài tập lập trình C++ tự động kết hợp kiểm tra ràng buộc ngữ nghĩa (semantic constraints) trước khi công bố điểm. Dự án tập trung vào việc ngăn ngừa các vi phạm quy chế bài nộp (ví dụ: dùng thư viện cấm, sai giải thuật bắt buộc) mà các bài kiểm tra chức năng thông thường không bắt được.

## 1. Quickstart (Clone & Setup)

**Yêu cầu:** Node.js **>= 22** (kèm npm). Kiểm tra bằng `node -v`.

Để thiết lập môi trường phát triển cục bộ và đảm bảo vượt qua toàn bộ các cổng kiểm tra (quality gate), thực hiện theo các bước sau:

### Bước 1: Sao chép repository

```bash
git clone https://github.com/AWAD-2Vinh-1Duong/LeetKOB
cd LeeTKOB
```

### Bước 2: Cài đặt phụ thuộc

Cài đúng các phiên bản đã khoá trong `package-lock.json` (giống hệt CI):

```bash
npm ci
```

### Bước 3: Cấu hình biến môi trường

Dự án sử dụng file `.env.example` để khai báo các cấu hình môi trường cần thiết mà không chứa bất kỳ secret nào. Sao chép để tạo file cấu hình cục bộ:

```bash
cp .env.example .env
```

> **Cảnh báo an toàn**: File `.env` đã được liệt kê trong `.gitignore`. Tuyệt đối không commit bất kỳ thông tin nhạy cảm, API key hoặc mật khẩu nào vào lịch sử Git.

## 2. Quality Gate & Kiểm tra đồng nhất (One Command Checks)

Để đảm bảo chất lượng mã nguồn và thỏa mãn yêu cầu của Tiêu chí 3, các kiểm tra cục bộ và trên CI GitHub Actions sử dụng **cùng một bộ lệnh duy nhất**:

| Mục đích kiểm tra  | Lệnh thực thi (Local & CI) | Mô tả                                                                                              |
| ------------------ | -------------------------- | -------------------------------------------------------------------------------------------------- |
| **Lint Check**     | `npm run lint`             | Kiểm tra quy tắc định dạng và lỗi cú pháp tĩnh                                                     |
| **Format Check**   | `npm run format:check`     | Xác minh mã nguồn tuân thủ quy chuẩn trình bày                                                     |
| **Type Check**     | `npm run typecheck`        | Phân tích kiểu dữ liệu tĩnh (nếu áp dụng)                                                          |
| **Contract Tests** | `npm test`                 | Chạy toàn bộ test `node:test` trong `tests/` (contract, auth, labs, grading, sandbox, middlewares) |
| **Chạy tất cả**    | `npm run check`            | Lệnh tổng hợp chạy toàn bộ các kiểm tra trên trước khi commit/push                                 |

Tất cả các lệnh trên khi chạy trên một bản clone mới đều phải trả về trạng thái màu xanh (green/pass).

- CI phải chạy **đúng** `npm ci` rồi `npm run check` — không thêm, không bớt bước nào so với local.
- Format check báo đỏ? Chạy `npm run format` để Prettier tự sửa, rồi commit lại.
- `npm run check` dừng ở bước đầu tiên bị lỗi (các lệnh nối bằng `&&`).

**Lệnh test (giảng viên có thể chạy sau khi đã cài xong dependency và ngắt mạng):**

```bash
npm ci                 # cần mạng, chỉ một lần
npm run lint           # ESLint
npm test               # toàn bộ test; dùng repository in-memory và model giả, không cần DB, Docker hay mạng
```

- Các test `*-postgres.test.js` tự bỏ qua khi không có `DATABASE_URL`. Để chạy chúng: `export DATABASE_URL=postgresql://...; npm run db:migrate; npm test`.
- Test sandbox chạy container thật chỉ khi có Docker và `SANDBOX_DOCKER=1`:
  ```bash
  docker build -f Dockerfile.sandbox -t leetkob-sandbox .
  SANDBOX_DOCKER=1 node --test tests/sandbox/sandbox-attacks.test.js
  ```
- Không test nào gọi model thật (luật mục 4 `AGENTS.md`); lần chạy model thật là thủ công và nằm ở `docs/tasks/PA3/submission/dev-run/`.

## 2b. Checker command (`MODEL_OFF=1`)

One command reads a dataset folder in the dev-set layout (`problems/<id>/statement.md`, `constraints.json`, `solutions/<id>/*.cpp`) and writes one prediction line per (solution, constraint). With `MODEL_OFF=1` it runs the hard rules only, writes `unsure` for every semantic constraint and opens no network connection.

```bash
MODEL_OFF=1 node src/checker.js --data eval/dev-set --out predictions.jsonl
node eval/dev-set/eval.mjs --data eval/dev-set --predictions predictions.jsonl
```

Docker image (no `.env`, no tests or eval data inside):

```bash
docker build -f Dockerfile.checker -t leetkob-checker .
docker run --rm --network none --memory 512m --pids-limit 64 -e MODEL_OFF=1 \
  -v "$PWD/eval/dev-set:/data:ro" leetkob-checker --data /data > predictions.jsonl
```

Options: `--out <file>` (default: stdout), `--call-log <file>` (model calls, empty with the model off).

## 2c. Kiến trúc & Cô lập Sandbox

```
Client ──HTTPS──> Caddy ──> API (src/server.js) ──> PostgreSQL
                                                      ▲  judge_jobs (hàng đợi, FOR UPDATE SKIP LOCKED)
                       Worker (src/worker.js) ────────┘  verdicts, llm_call_logs
                          │  1. chạy mọi test của lab trong sandbox (biên dịch + chạy)
                          │  2. chỉ khi Accepted: hard rules (code) rồi ConstraintJudge (model)
                          └─> docker run leetkob-sandbox (Dockerfile.sandbox)
```

- **API** nhận bài nộp (`202 queued`) và ghi `submissions` + `judge_jobs` trong một transaction. **Worker** là tiến trình riêng, kéo job bằng `FOR UPDATE SKIP LOCKED`; verdict lưu idempotent (khóa `sha256(submission, constraint)`), nên dừng/bật worker vẫn chỉ có một bộ verdict (luật `Q1`).
- Verdict luôn lưu với `deduction = 0`, `is_reviewed = false`: không verdict nào của model đổi điểm sinh viên khi chưa có TA duyệt. Đầu ra model qua kiểm tra schema (`zod`) và timeout; lỗi thì thành `unsure`.
- **9 giới hạn của sandbox** (`src/modules/grading/service/sandbox-runner.js`, được kiểm bằng 9 bài tấn công `tests/sandbox/attacks/m1`–`m9`, chạy trong CI trên tag `pa3`):
  1. không mạng (`--network none`);
  2. giới hạn CPU (`--ulimit cpu`);
  3. giới hạn thời gian thực, kill **cả container** (`docker rm -f`);
  4. giới hạn RAM + swap bằng nhau (`--memory` = `--memory-swap`);
  5. giới hạn số tiến trình (`--pids-limit`);
  6. giới hạn kích thước output;
  7. user không phải root (`--user 10001:10001`, `--cap-drop ALL`, `no-new-privileges`, rootfs `--read-only`);
  8. không mount thư mục host, không `/var/run/docker.sock` (mã nguồn đi qua stdin dạng base64);
  9. không secret: chỉ truyền các biến `SANDBOX_*`; `LLM_*`, `DATABASE_URL`, `JWT_SECRET` không vào container.
- **Triển khai:** `docker-compose.yml` chạy `postgres`, `migrate`, `api`, `worker`, `caddy` (HTTPS tự động qua `PUBLIC_DOMAIN`). Chỉ `worker` được mount Docker socket; `api` thì không. `npm run db:seed` tạo 2 lớp và 5 tài khoản thử.

## 3. Chính sách phân quyền, Secret & Model API Spending Cap

Tuân thủ Tiêu chí 2 về quản lý chi phí và an toàn bảo mật:

- **Phân quyền của AI Agent**: viết rõ thành 3 tầng trong [`AGENTS.md` mục 5](AGENTS.md) — _Run Freely_ (được làm), _Ask First_ (phải hỏi trước), _Never the Agent_ (cấm tuyệt đối).

- **Biến môi trường**: [`.env.example`](.env.example) liệt kê mọi biến dự án đọc, **tất cả để trống giá trị**. Nhóm biến `LLM_*` chỉ tiến trình app đọc; sandbox chỉ nhận nhóm `SANDBOX_*` (giới hạn tài nguyên), không nhận secret nào.

- **Không có secret trong lịch sử Git**: kiểm tra bằng [gitleaks](https://github.com/gitleaks/gitleaks) trên toàn bộ lịch sử mọi nhánh:

  ```bash
  gitleaks detect --source . --log-opts="--all"
  ```

  Kết quả ngày 2026-11-08 (gitleaks 8.18.4): `47 commits scanned … no leaks found`.

  [`.gitleaksignore`](.gitleaksignore) bỏ qua đúng một báo động giả: `Idempotency-Key` ví dụ (một UUID) trong request mẫu của [contract](docs/contract/post-labs-submissions.md), không phải secret. Mọi phát hiện khác vẫn làm lệnh trên báo lỗi.

- **Model Provider & Model được chọn**: Google Gemini — **Gemini 3.5 Flash** (`gemini-3.5-flash`) qua **Google AI Studio** (gói Free), gọi bằng adapter `ConstraintJudge` với endpoint tương thích OpenAI đặt ở `LLM_BASE_URL`; tên model đặt qua biến `LLM_MODEL`. Ban đầu nhóm ghi Gemini 1.5 Flash (bị Google tắt từ tháng 9/2025), sau đó là Gemini 3.6 Flash. **Lần chạy dev set đã commit** (`docs/tasks/PA3/submission/dev-run/`) được đo trước khi chuyển, với `ag/gemini-3.8-flash` qua 9router; call log ghi đúng tên model đó.

- **Spending cap: 0 USD**: model chạy trên **Google AI Studio gói Free, không gắn billing** (key chỉ nằm trong `.env` trên máy chạy app, không bao giờ vào sandbox hay Git). Lần đo dev set trước đó dùng provider `ag/` của 9router, cũng miễn phí (Thế Vinh xác nhận ngày 2026-11-25). PA#2 dùng key AI Studio Free tier ([ảnh dashboard](docs/tasks/PA2/submission/assets/provider-dashboard.png)). Nếu sau này đổi sang provider tính phí, phải đặt cap dạng số trên provider và cập nhật mục này **trước** khi dùng.

- **Chi phí một lab (80 bài nộp)**: đo từ lần chạy thật trên dev set ([call log](docs/tasks/PA3/submission/dev-run/call-log.jsonl), 47 bài, 39 lần gọi; 8 bài chỉ có ràng buộc ban list nên hard rules quyết, không gọi model): 117.330 token vào + 1.906 token ra, trung bình **2.496,4 vào + 40,6 ra mỗi bài**. Một lab 80 bài ≈ 80 × 2.496,4 = **199.711 token vào** và 80 × 40,6 = **3.244 token ra**. Chi phí = 199.711 × giá_vào/10⁶ + 3.244 × giá_ra/10⁶ = **0 USD** vì provider miễn phí (giá = 0). Khoảng 2.000 token vào mỗi lần gọi do 9router tự thêm; trực tiếp qua AI Studio con số này thấp hơn, nên 199.711 token vào là cận trên. Nếu có giá, đặt `LLM_INPUT_USD_PER_MTOK` / `LLM_OUTPUT_USD_PER_MTOK` thì call log tự tính chi phí từng lần gọi. Giới hạn chi phí theo lab (`LLM_COST_CAP_PER_LAB_USD`) **chưa được cài** (dự kiến PA#4).

- **Cô lập Sandbox**: Toàn bộ tiến trình chạy mã nguồn sinh viên trong sandbox hoàn toàn **không có quyền truy cập Internet** và **không nhận bất kỳ API secret nào** trong biến môi trường cũng như hệ thống tập tin.

## 4. Cấu trúc tài liệu & Chỉ dẫn dành cho AI Agents

Dự án áp dụng quy chuẩn quản lý mã nguồn có sự hỗ trợ của AI, được phân tách minh bạch thành các tài liệu tại thư mục gốc và thư mục `docs/`:

- `AGENTS.md`: Chứa các quy tắc nền tảng chung gồm 5 mục: Stack, Commands, Conventions, Never, và Permission Boundaries. **Mọi Coding Agent bắt buộc phải đọc file này trước tiên.**

- `CLAUDE.md`: Chỉ dẫn bổ sung dành riêng cho Claude Code; dòng đầu `@AGENTS.md` nạp luật chung trước.

- `.github/copilot-instructions.md`: Chỉ dẫn bổ sung cho GitHub Copilot (yêu cầu đọc `AGENTS.md` trước).

- `docs/contract/post-labs-submissions.md`: Bản đặc tả chi tiết hợp đồng của endpoint được chọn, tuân thủ tiêu chuẩn RFC 9457 Problem Details và quy tắc Idempotency.

- `docs/tasks/`: Thư mục quản lý toàn bộ tài liệu cho các bài tập thực hành (PA):
  - `PA-template/`: Bản mẫu chuẩn hóa phân chia 3 thư mục con: `context/` (nhật ký làm việc hàng ngày), `task/` (đề bài, rubric, checklist), và `submission/` (kết quả nộp bài).
  - `PA2/`: Lưu trữ toàn bộ tài liệu PA#2 (bao gồm `docs/tasks/PA2/submission/PA2.md`, `SELF_ASSESSMENT_REPORT.md` và các ảnh chụp minh chứng).
  - `PA3/`: Tài liệu, checklist và nhật ký ngữ cảnh triển khai cho PA#3 (Prototype với LLM Feature Running).

- `AI-LOG.md`: Nhật ký ghi lại các quyết định chấp thuận, chỉnh sửa (Changed) hoặc bác bỏ (Rejected) đề xuất của AI trong quá trình thiết lập harness và quality gate.

# Repository structure:

```Plaintext
LeeTKOB/
├── .github/
│   ├── copilot-instructions.md      # Quy tắc cụ thể nếu sử dụng Copilot làm Coding Agent
│   └── workflows/
│       └── ci.yml                   # (Tiêu chí 3, 4) Pipeline CI chặn merge, chạy 1 lệnh duy nhất cho lint/format/typecheck/test
├── docs/
│   ├── LeeTKOB — class project brief.md # Đề bài & tài liệu tổng quan dự án môn học
│   ├── SELF_ASSESSMENT_REPORT template.md # Bản mẫu báo cáo tự đánh giá
│   ├── contract/
│   │   └── post-labs-submissions.md # (Tiêu chí 5) Hợp đồng chi tiết endpoint POST /labs/:labId/submissions (RFC 9457 & Idempotency)
│   └── tasks/                       # Quản lý tài liệu theo từng kỳ Practical Assignment (PA)
│       ├── PA-template/             # Template mẫu cho các kỳ PA (context, task, submission)
│       ├── PA2/                     # Tài liệu & kết quả bàn giao PA#2 (Harness & Quality Gate)
│       │   ├── context/             # Ghi nhận ngữ cảnh làm việc của các thành viên (QuangVinh.md, TheVinh.md)
│       │   ├── submission/          # File nộp bài (PA2.md, SELF_ASSESSMENT_REPORT.md, assets/)
│       │   └── task/                # Đề bài, rubric và checklist của PA#2
│       └── PA3/                     # Tài liệu đang triển khai cho PA#3 (Prototype with LLM Feature Running)
│           ├── context/             # Nhật ký ngữ cảnh (context-dd-mm.md) theo quy định AGENTS.md
│           ├── submission/          # Bản mẫu báo cáo tự đánh giá PA#3
│           └── task/                # Rubric và checklist thực thi PA#3
├── eval/
│   ├── dev-set/                     # Dev set của giảng viên, giữ nguyên từng byte (không sửa)
│   └── custom-cases/                # Ca eval tự tạo (cùng layout), có trap và injection
├── migrations/                      # SQL cho node-pg-migrate (schema, class_staff)
├── scripts/
│   └── seed-pa3.js                  # `npm run db:seed`: 2 lớp + 5 tài khoản thử (idempotent)
├── src/
│   ├── app.js                       # Gắn request context, router, error handler
│   ├── checker.js                   # Lệnh checker CLI (MODEL_OFF=1)
│   ├── config.js
│   ├── container.js                 # Composition root: API và worker
│   ├── server.js                    # Tiến trình API
│   ├── worker.js                    # Tiến trình worker (hàng đợi + sandbox)
│   ├── middlewares/                 # auth, role, json body, idempotency key, request context, error handler
│   ├── modules/
│   │   ├── auth/                    # controller / repository / service
│   │   ├── grading/                 # hard rules, tokenizer, sanitize, ConstraintJudge, sandbox-runner, worker, hàng đợi judge_jobs
│   │   ├── labs/                    # controller / repository / service
│   │   └── submissions/             # controller / repository / service
│   └── shared/
│       ├── db.js
│       ├── problems.js
│       └── validation.js
├── tests/
│   ├── auth/  config.test.js  contract/  grading/  labs/  middlewares/
│   └── sandbox/                     # 9 bài tấn công M1–M9 (attacks/*.cpp) + test
├── Caddyfile                        # Reverse proxy HTTPS
├── Dockerfile.app                   # Image api/worker
├── Dockerfile.checker               # Image checker CLI
├── Dockerfile.sandbox               # Image sandbox (g++, user không root)
├── docker-compose.yml               # postgres, migrate, api, worker, caddy
├── .env.example                     # (Tiêu chí 2) Liệt kê mọi biến môi trường, tuyệt đối bỏ trống giá trị
├── .gitignore                       # Đảm bảo bỏ qua file .env, node_modules để không lọt secret vào Git
├── .gitleaksignore                  # Bỏ qua false positive cho công cụ quét secret gitleaks
├── .prettierignore                  # Bỏ qua các file tài liệu khi chạy Prettier format
├── .prettierrc.json                 # (Tiêu chí 3) Cấu hình Prettier (.prettierignore: bỏ qua tài liệu đề bài)
├── AGENTS.md                        # (Tiêu chí 1, 2) Quy tắc chung cho mọi Coding Agent: stack, commands, conventions, never + phân quyền 3 tầng
├── AI-LOG.md                        # (Tiêu chí 7) Ghi chú các công cụ AI đã dùng và các quyết định Changed/Rejected thực tế
├── CLAUDE.md                        # Quy tắc riêng cho Claude Code (import AGENTS.md bằng @AGENTS.md)
├── eslint.config.js                 # (Tiêu chí 3) Cấu hình ESLint (flat config)
├── package.json                     # (Tiêu chí 3) Khai báo scripts (lint / format:check / typecheck / test / check)
├── package-lock.json                # Khóa chính xác phiên bản các package phụ thuộc
├── PA3.md                           # Bài nộp PA#3 (URL public, tài khoản, CI, checker, dev-run, video)
├── PA3-SELF_ASSESSMENT_REPORT.md    # Tự đánh giá PA#3
├── README.md                        # Hướng dẫn setup, chạy các lệnh check đồng nhất và cấu trúc dự án
└── tsconfig.json                    # (Tiêu chí 3) Type check JS bằng tsc --checkJs
```

---
