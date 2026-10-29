# Advanced-Web-Dev
This repository is created for Advanced Web Development course


Repository structure:
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