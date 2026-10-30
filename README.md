# Repository structure:
```Plaintext
LeeTKOB/
├── .cursor/
│   └── rules/                       # (Tiêu chí 1) Chứa các file quy tắc cho AI: stack, commands, conventions, never.
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
├── CLAUDE.md                        # là file chứa các quy tắc cụ thể nếu sử dụng CLAUDE Code làm Coding Agent    
├── AI-RULES.md                      # (là AGENTS.md) chứa các quy tắc chung dành cho AI (các Coding Agent cần đọc AI-RULES.md truopcws khi đọc file rules cụ thể của chúng)
├── PA2.md                           # File nộp bài gốc chứa link repo public, screenshot protect branch, PR, CI run
├── README.md                        # Hướng dẫn setup, chạy các lệnh check đồng nhất, và ghi rõ hạn mức chi tiêu (spending cap) của API Key.
└── SELF_ASSESSMENT_REPORT.md        # Bảng tự đánh giá điểm từng tiêu chí kèm minh chứng (commit, PR, link file)
```

---


# LeeTKOB — Grading Harness & Quality Gate

LeeTKOB là nền tảng hỗ trợ Trợ giảng (TA) chấm bài tập lập trình C++ tự động kết hợp kiểm tra ràng buộc ngữ nghĩa (semantic constraints) trước khi công bố điểm[cite: 3]. Dự án tập trung vào việc ngăn ngừa các vi phạm quy chế bài nộp (ví dụ: dùng thư viện cấm, sai giải thuật bắt buộc) mà các bài kiểm tra chức năng thông thường không bắt được.


## 1. Quickstart (Clone & Setup)

Để thiết lập môi trường phát triển cục bộ và đảm bảo vượt qua toàn bộ các cổng kiểm tra (quality gate), thực hiện theo các bước sau[cite: 1]:

### Bước 1: Sao chép repository
```bash
git clone <URL_REPOSITORY_PUBLIC>
cd LeeTKOB

```

### Bước 2: Cài đặt phụ thuộc

Chạy lệnh cài đặt các gói phụ thuộc tương ứng với môi trường phát triển của nhóm:

```bash
# Ví dụ: cài đặt package quản lý phụ thuộc của dự án
npm install

```

### Bước 3: Cấu hình biến môi trường

Dự án sử dụng file `.env.example` để khai báo các cấu hình môi trường cần thiết mà không chứa bất kỳ secret nào. Sao chép để tạo file cấu hình cục bộ:

```bash
cp .env.example .env

```

> **Cảnh báo an toàn**: File `.env` đã được liệt kê trong `.gitignore`. Tuyệt đối không commit bất kỳ thông tin nhạy cảm, API key hoặc mật khẩu nào vào lịch sử Git.
> 
> 



## 2. Quality Gate & Kiểm tra đồng nhất (One Command Checks)

Để đảm bảo chất lượng mã nguồn và thỏa mãn yêu cầu của Tiêu chí 3, các kiểm tra cục bộ và trên CI GitHub Actions sử dụng **cùng một bộ lệnh duy nhất**:

| Mục đích kiểm tra | Lệnh thực thi (Local & CI) | Mô tả |
| --- | --- | --- |
| **Lint Check** | `npm run lint` | Kiểm tra quy tắc định dạng và lỗi cú pháp tĩnh|
| **Format Check** | `npm run format:check` | Xác minh mã nguồn tuân thủ quy chuẩn trình bày|
| **Type Check** | `npm run typecheck` | Phân tích kiểu dữ liệu tĩnh (nếu áp dụng)|
| **Contract Tests** | `npm test` | Chạy toàn bộ các bài kiểm tra hợp đồng API trong `tests/contract/`|
| **Chạy tất cả** | `npm run check` | Lệnh tổng hợp chạy toàn bộ các kiểm tra trên trước khi commit/push|

Tất cả các lệnh trên khi chạy trên một bản clone mới đều phải trả về trạng thái màu xanh (green/pass).



## 3. Chính sách phân quyền & Model API Spending Cap

Tuân thủ Tiêu chí 2 về quản lý chi phí và an toàn bảo mật:

* **Model Provider & Model được chọn**: Đang cấu hình (khai báo mô hình LLM nhóm lựa chọn sử dụng từ PA#3, ví dụ: `gemini-2.5-flash` hoặc OpenAI tương đương).


* **Hạn mức chi tiêu (Spending Cap)**: Đã thiết lập hạn mức trần cố định tại bảng điều khiển nhà cung cấp (Provider Dashboard) ở mức tối đa **$ USD/tháng** (hoặc gói miễn phí có rate-limit chặt chẽ) nhằm ngăn chặn việc tràn ngân sách ngoài ý muốn khi chạy đánh giá hàng loạt.


* **Ước tính chi phí một bài Lab**: Dự kiến không vượt quá **$ USD / 80 bài nộp**.


* **Cô lập Sandbox**: Toàn bộ tiến trình chạy mã nguồn sinh viên trong sandbox hoàn toàn **không có quyền truy cập Internet** và **không nhận bất kỳ API secret nào** trong biến môi trường cũng như hệ thống tập tin.





## 4. Cấu trúc tài liệu & Chỉ dẫn dành cho AI Agents

Dự án áp dụng quy chuẩn quản lý mã nguồn có sự hỗ trợ của AI, được phân tách minh bạch thành các tài liệu tại thư mục gốc:

* `AI-RULES.md`: Chứa các quy tắc nền tảng chung (Core Rules) gồm 4 mục: Stack, Commands, Conventions, và Never. **Mọi Coding Agent bắt buộc phải đọc file này trước tiên.**


* `CLAUDE.md`: Chỉ dẫn bổ sung dành riêng cho Claude Code.


* `.github/copilot-instructions.md`: Chỉ dẫn bổ sung cho GitHub Copilot.


* `.cursor/rules/`: Thư mục chỉ dẫn ngữ cảnh cho Cursor IDE.


* `docs/contract/post-labs-submissions.md`: Bản đặc tả chi tiết hợp đồng của endpoint được chọn, tuân thủ tiêu chuẩn RFC 9457 Problem Details và quy tắc Idempotency.


* `AI-LOG.md`: Nhật ký ghi lại các quyết định chấp thuận, chỉnh sửa (Changed) hoặc bác bỏ (Rejected) đề xuất của AI trong quá trình thiết lập harness và quality gate.


* `PA2.md`: Tài liệu tổng hợp các đường dẫn minh chứng cho checkpoint PA#2 (link PR bị chặn, commit sửa xanh, link CI run của tag `pa2`, và deliberate contract break).


* `SELF_ASSESSMENT_REPORT.md`: Báo cáo tự chấm điểm chi tiết theo rubric 100 điểm của PA#2.



