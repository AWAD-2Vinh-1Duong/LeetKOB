
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

| Mục đích kiểm tra  | Lệnh thực thi (Local & CI) | Mô tả                                                              |
| ------------------ | -------------------------- | ------------------------------------------------------------------ |
| **Lint Check**     | `npm run lint`             | Kiểm tra quy tắc định dạng và lỗi cú pháp tĩnh                     |
| **Format Check**   | `npm run format:check`     | Xác minh mã nguồn tuân thủ quy chuẩn trình bày                     |
| **Type Check**     | `npm run typecheck`        | Phân tích kiểu dữ liệu tĩnh (nếu áp dụng)                          |
| **Contract Tests** | `npm test`                 | Chạy toàn bộ các bài kiểm tra hợp đồng API trong `tests/contract/` |
| **Chạy tất cả**    | `npm run check`            | Lệnh tổng hợp chạy toàn bộ các kiểm tra trên trước khi commit/push |

Tất cả các lệnh trên khi chạy trên một bản clone mới đều phải trả về trạng thái màu xanh (green/pass).

- CI phải chạy **đúng** `npm ci` rồi `npm run check` — không thêm, không bớt bước nào so với local.
- Format check báo đỏ? Chạy `npm run format` để Prettier tự sửa, rồi commit lại.
- `npm run check` dừng ở bước đầu tiên bị lỗi (các lệnh nối bằng `&&`).

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

- **Model Provider & Model được chọn**: Google Gemini — **Gemini 3.6 Flash** (`gemini-3.6-flash`, Free tier), cấu hình qua biến `LLM_MODEL`. Ban đầu nhóm ghi Gemini 1.5 Flash, nhưng model này đã bị Google tắt từ tháng 9/2025 nên được thay thế.

- **Spending cap: 0 USD (cứng, do provider áp)**: API key thuộc project `For-Github-CodeSpace` trên Google AI Studio, **không gắn billing account** ([ảnh dashboard](docs/tasks/PA2/submission/assets/provider-dashboard.png): _Billing Tier: Free tier — Set up billing_). Không có billing thì Google không thể tính tiền: request vượt quota Free tier bị trả về `429 RESOURCE_EXHAUSTED` thay vì phát sinh phí. Nhóm không bật billing vì AI Studio yêu cầu trả trước 800.000 VNĐ. Nếu sau này bật billing, phải đặt budget/cap dạng số trên provider và cập nhật mục này **trước** khi dùng paid tier.

- **Chi phí một lab (80 bài nộp)**: **0 USD** trên Free tier. Giới hạn thực tế là quota Free tier; ngoài ra app sẽ chặn thêm bằng biến `LLM_COST_CAP_PER_LAB_USD` trong adapter `ConstraintJudge` (từ PA#3).

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
├── src/                             # Mã nguồn hệ thống
│   ├── controllers/                 # Lớp Routing & Controllers (nhận HTTP request, trả RFC 9457 Problem Details)
│   ├── middlewares/                 # Xử lý phân quyền & authentication (Tiêu chí 5 - Who may call it)
│   ├── repositories/                # Lớp Data Access (In-memory storage, Dependency Injection)
│   ├── services/                    # Lớp Business Logic (xử lý logic bài nộp, gọi Sandbox, xử lý Idempotency)
│   ├── app.js                       # Điểm khởi chạy ứng dụng (Setup Express & DI container)
│   └── problems.js                  # Định nghĩa các loại RFC 9457 Problem Details
├── tests/
│   └── contract/                    # (Tiêu chí 6) Chứa các contract tests kiểm thử endpoint (bắt chặt lỗi, ownership, idempotency)
│       └── post-labs-submissions.test.js
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
├── README.md                        # Hướng dẫn setup, chạy các lệnh check đồng nhất và cấu trúc dự án
└── tsconfig.json                    # (Tiêu chí 3) Type check JS bằng tsc --checkJs
```

---