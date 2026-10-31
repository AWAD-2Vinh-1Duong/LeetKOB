# Repository structure:

```Plaintext
LeeTKOB/
├── .github/
│   └── copilot-instructions.md      # là file chứa các quy tắc cụ thể nếu sử dụng Copilot làm Coding Agent
│   └── workflows/
│       └── ci.yml                   # (Tiêu chí 3, 4) Pipeline CI chặn merge, chạy 1 lệnh duy nhất cho lint/format/test.
├── docs/
│   └── contract/
│       └── post-labs-submissions.md # (Tiêu chí 5) Hợp đồng chi tiết cho 1 endpoint (chọn POST nộp bài hoặc GET review-queue).
├── src/                             # Mã nguồn hệ thống
│   ├── controllers/                 # Lớp Routing & Controllers (nhận HTTP request, trả RFC 9457 Problem Details)
│   ├── services/                    # Lớp Business Logic (xử lý logic bài nộp, gọi Sandbox, xử lý Idempotency)
│   ├── repositories/                # Lớp Data Access (tương tác với database, Dependency Injection)
│   ├── middlewares/                 # Xử lý phân quyền (Tiêu chí 5 - Who may call it)
│   └── app.js                       # Điểm khởi chạy ứng dụng (Setup DI container)
├── tests/
│   └── contract/                    # (Tiêu chí 6) Chứa các contract tests "có thể cắn" (bắt chặt lỗi, ownership, idempotency).
├── .env.example                     # (Tiêu chí 2) Liệt kê mọi biến môi trường, tuyệt đối bỏ trống giá trị.
├── .gitignore                       # Đảm bảo bỏ qua file .env để không lọt secret vào lịch sử git
├── AI-LOG.md                        # (Tiêu chí 7) Ghi chú các công cụ AI đã dùng và các quyết định Changed/Rejected thực tế
├── AGENTS.md                        # (Tiêu chí 1, 2) Quy tắc chung cho mọi Coding Agent: stack, commands, conventions, never + phân quyền 3 tầng
├── CLAUDE.md                        # Quy tắc riêng cho Claude Code (import AGENTS.md bằng @AGENTS.md)
├── PA2.md                           # File nộp bài gốc chứa link repo public, screenshot protect branch, PR, CI run
├── eslint.config.js                 # (Tiêu chí 3) Cấu hình ESLint
├── .prettierrc.json                 # (Tiêu chí 3) Cấu hình Prettier (.prettierignore: bỏ qua tài liệu đề bài)
├── tsconfig.json                    # (Tiêu chí 3) Type check JS bằng tsc --checkJs
├── package.json                     # (Tiêu chí 3) Các script lint / format:check / typecheck / test / check
├── README.md                        # Hướng dẫn setup, chạy các lệnh check đồng nhất, và ghi rõ hạn mức chi tiêu (spending cap) của API Key.
└── SELF_ASSESSMENT_REPORT.md        # Bảng tự đánh giá điểm từng tiêu chí kèm minh chứng (commit, PR, link file)
```

---

# LeeTKOB — Grading Harness & Quality Gate

LeeTKOB là nền tảng hỗ trợ Trợ giảng (TA) chấm bài tập lập trình C++ tự động kết hợp kiểm tra ràng buộc ngữ nghĩa (semantic constraints) trước khi công bố điểm. Dự án tập trung vào việc ngăn ngừa các vi phạm quy chế bài nộp (ví dụ: dùng thư viện cấm, sai giải thuật bắt buộc) mà các bài kiểm tra chức năng thông thường không bắt được.

## 1. Quickstart (Clone & Setup)

**Yêu cầu:** Node.js **>= 22** (kèm npm). Kiểm tra bằng `node -v`.

Để thiết lập môi trường phát triển cục bộ và đảm bảo vượt qua toàn bộ các cổng kiểm tra (quality gate), thực hiện theo các bước sau:

### Bước 1: Sao chép repository

```bash
git clone <URL_REPOSITORY_PUBLIC>
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

  Kết quả ngày 2026-10-31: `11 commits scanned … no leaks found`.

- **Model Provider & Model được chọn**: **TODO** — nhóm chưa chốt (cần trước PA#3).

- **Hạn mức chi tiêu (Spending Cap)**: **TODO** — đặt hạn mức trần tại bảng điều khiển của nhà cung cấp ở mức tối đa **`<số>` USD/tháng** (hoặc dùng gói miễn phí có rate-limit), chụp màn hình làm minh chứng, rồi điền số vào đây. Mục đích: không tràn ngân sách khi chạy đánh giá hàng loạt.

- **Ước tính chi phí một bài Lab**: **TODO** — dự kiến không vượt quá **`<số>` USD / 80 bài nộp**.

- **Cô lập Sandbox**: Toàn bộ tiến trình chạy mã nguồn sinh viên trong sandbox hoàn toàn **không có quyền truy cập Internet** và **không nhận bất kỳ API secret nào** trong biến môi trường cũng như hệ thống tập tin.

## 4. Cấu trúc tài liệu & Chỉ dẫn dành cho AI Agents

Dự án áp dụng quy chuẩn quản lý mã nguồn có sự hỗ trợ của AI, được phân tách minh bạch thành các tài liệu tại thư mục gốc:

- `AGENTS.md`: Chứa các quy tắc nền tảng chung (Core Rules) gồm 4 mục: Stack, Commands, Conventions, và Never. **Mọi Coding Agent bắt buộc phải đọc file này trước tiên.**

- `CLAUDE.md`: Chỉ dẫn bổ sung dành riêng cho Claude Code; dòng đầu `@AGENTS.md` nạp luật chung trước.

- `.github/copilot-instructions.md`: Chỉ dẫn bổ sung cho GitHub Copilot (yêu cầu đọc `AGENTS.md` trước).

- `docs/contract/post-labs-submissions.md`: Bản đặc tả chi tiết hợp đồng của endpoint được chọn, tuân thủ tiêu chuẩn RFC 9457 Problem Details và quy tắc Idempotency.

- `AI-LOG.md`: Nhật ký ghi lại các quyết định chấp thuận, chỉnh sửa (Changed) hoặc bác bỏ (Rejected) đề xuất của AI trong quá trình thiết lập harness và quality gate.

- `PA2.md`: Tài liệu tổng hợp các đường dẫn minh chứng cho checkpoint PA#2 (link PR bị chặn, commit sửa xanh, link CI run của tag `pa2`, và deliberate contract break).

- `SELF_ASSESSMENT_REPORT.md`: Báo cáo tự chấm điểm chi tiết theo rubric 100 điểm của PA#2.
