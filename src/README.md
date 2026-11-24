# LeeTKOB Backend (`src/`) — Kiến trúc Modular Monolith

Thư mục `src/` chứa toàn bộ mã nguồn backend của dự án **LeeTKOB** — nền tảng kiểm thử và chấm bài tập lập trình C++ tự động kết hợp phân tích ràng buộc ngữ nghĩa (semantic constraints) bằng LLM.

Hệ thống được thiết kế theo mô hình **Modular Monolith (Kiến trúc hướng Module / Feature-driven Architecture)** trên nền **Node.js 22 LTS**, **Express 5**, và **PostgreSQL 16**.

---

## 1. Triết lý kiến trúc & Nguyên lý cốt lõi

 Kiến trúc hiện tại trên nhánh `dev` tổ chức mã nguồn **theo từng miền nghiệp vụ (Feature Modules)**:

1. **Feature-Based Modularization (Vertical Slices):**
   Mỗi tính năng/domain nghiệp vụ (`auth`, `labs`, `submissions`, `grading`) là một module độc lập đặt trong `src/modules/<module>/`. Bên trong mỗi module tự đóng gói các tầng:
   - `controller/`: Chứa `*.routes.js` (định tuyến HTTP, gắn middleware) và `*.controller.js` (đọc request, validate input bằng Zod, gọi service, trả response).
   - `service/`: Chứa `*.service.js` (logic nghiệp vụ lõi, xác thực quyền dựa trên dữ liệu, kiểm tra deadline, xử lý nghiệp vụ).
   - `repository/`: Chứa hợp đồng giao diện `*.repository.js` cùng hai bản hiện thực: `*.repository.postgres.js` (chạy thật) và `*.repository.memory.js` (chạy test).

2. **Composition Root & Dependency Injection (`src/container.js`):**
   - Mọi class (Service, Controller, Repository) **không tự tạo dependency** và **không đọc trực tiếp `process.env`**.
   - `src/container.js` là file duy nhất quyết định interface nào được gắn với implementation nào (PostgreSQL hay In-Memory) và khởi tạo các đối tượng qua Constructor Injection.
   - Nhờ đó, backend có thể chạy 100% độc lập với database trong các bài kiểm thử hoặc chuyển đổi cơ chế lưu trữ mà không phải sửa đổi code nghiệp vụ.

3. **Dual Storage Engine (Database Agnostic Testing):**
   - **PostgreSQL 16 (`*.repository.postgres.js`)**: Sử dụng SQL thuần qua `pg`, tối ưu hóa hiệu năng, xử lý race-condition bằng `ON CONFLICT DO NOTHING` và hàng đợi `FOR UPDATE SKIP LOCKED`.
   - **In-Memory (`*.repository.memory.js`)**: Giả lập dữ liệu trong bộ nhớ RAM, phục vụ chạy 190+ bài test hợp đồng (contract tests) siêu tốc trong vài giây mà không cần khởi động database.

4. **Bảo mật theo chiều sâu (Defense-in-Depth & Zero-Tolerance Guardrails):**
   - **Chống Timing Attack:** `AuthService` sử dụng kỹ thuật hash decoy (`this.decoy`) để thời gian phản hồi khi sai email và sai mật khẩu là tương đương nhau.
   - **Chống Enumeration Attack:** Trả về mã lỗi 404 giống hệt nhau giữa tài nguyên không tồn tại và tài nguyên thuộc về lớp học/sinh viên khác.
   - **Chống Prompt Injection & Bảo vệ quyền riêng tư:** `modules/grading/service/sanitize.js` loại bỏ toàn bộ comment C++ (nơi thường ẩn giấu mã tấn công prompt injection) và ẩn danh thông tin sinh viên (`redactIdentity`), giữ nguyên số thứ tự dòng code.
   - **Zero-Tolerance Model Guardrails:** Kết quả từ LLM phải vượt qua kiểm tra Zod schema nghiêm ngặt (`replySchema`). Mọi trường hợp timeout, lỗi schema, hoặc lỗi kết nối model đều tự động fallback về `unsure` và đưa vào Review Queue để Trợ giảng (TA) duyệt trực tiếp (quy chế bắt buộc của môn học).

5. **Chuẩn hóa API (RFC 9457 & IETF Idempotency):**
   - Mọi lỗi HTTP đều trả về chuẩn **RFC 9457 Problem Details** (`application/problem+json`) thông qua `src/shared/problems.js`.
   - Các mutation quan trọng (`POST /labs/:labId/submissions`) bắt buộc có header `Idempotency-Key`, đảm bảo tính an toàn khi retry request từ mạng chập chờn.

---

## 2. Cấu trúc thư mục `src/`

```
src/
├── app.js                          # Express App Factory: gắn request context, routes và error handler
├── config.js                       # Nạp và validate biến môi trường từ process.env
├── container.js                    # Composition Root: Dependency Injection container duy nhất của hệ thống
├── server.js                       # Điểm khởi chạy tiến trình: mở pool DB, lắng nghe cổng và graceful shutdown
│
├── middlewares/                    # HTTP Middlewares dùng chung cho toàn bộ ứng dụng
│   ├── index.js                    # Barrel export tập trung các middleware
│   ├── error-handler.middleware.js # Bộ xử lý lỗi tập trung chuẩn RFC 9457
│   ├── idempotency-key.middleware.js# Kiểm tra header Idempotency-Key
│   ├── json-body.middleware.js     # Parser JSON body kèm giới hạn kích thước an toàn
│   ├── request-context.middleware.js# Gán x-request-id và khởi tạo pino child logger
│   ├── require-auth.middleware.js  # Xác thực Bearer JWT token bằng thư viện jose
│   └── require-role.middleware.js  # Phân quyền RBAC (student, ta, admin)
│
├── modules/                        # Các module tính năng theo từng miền nghiệp vụ (Feature Modules)
│   ├── auth/                       # Module Quản lý Định danh & Xác thực
│   │   ├── controller/
│   │   │   ├── auth.controller.js  # Tiếp nhận đăng nhập, gọi AuthService
│   │   │   └── auth.routes.js      # Gắn route POST /auth/login
│   │   ├── repository/
│   │   │   ├── users.repository.js # JSDoc interface cho UserRepository
│   │   │   ├── users.repository.memory.js   # In-Memory store cho test
│   │   │   └── users.repository.postgres.js # PostgreSQL query SQL thuần
│   │   └── service/
│   │       ├── auth.service.js     # Logic đăng nhập, chống timing attack
│   │       ├── passwords.js        # Băm và kiểm tra mật khẩu bằng scrypt (node:crypto)
│   │       ├── roles.js            # Kiểm tra quyền: assertStaff, assertStudent, assertAdmin
│   │       └── tokens.js           # Ký và xác thực JWT Bearer token
│   │
│   ├── labs/                       # Module Quản lý Đề bài & Bài tập Lab
│   │   ├── controller/
│   │   │   ├── labs.controller.js  # Controller: tạo lab, xem lab, xem review queue
│   │   │   └── labs.routes.js      # Routes: POST /labs, GET /labs/:id, GET /labs/:id/review-queue
│   │   ├── repository/
│   │   │   ├── labs.repository.js  # JSDoc interface cho LabRepository
│   │   │   ├── labs.repository.memory.js   # In-Memory store
│   │   │   └── labs.repository.postgres.js # PostgreSQL store
│   │   └── service/
│   │       └── labs.service.js     # Quản lý lab, kiểm tra quyền xem theo lớp
│   │
│   ├── submissions/                # Module Quản lý Bài nộp C++
│   │   ├── controller/
│   │   │   ├── submissions.controller.js # Controller bài nộp
│   │   │   └── submissions.routes.js     # Routes: POST /labs/:labId/submissions, GET /submissions/:id
│   │   ├── repository/
│   │   │   ├── submissions.repository.js # JSDoc interface cho SubmissionRepository
│   │   │   ├── submissions.repository.memory.js   # In-Memory store
│   │   │   └── submissions.repository.postgres.js # PostgreSQL store (ON CONFLICT DO NOTHING)
│   │   └── service/
│   │       └── submissions.service.js    # Logic nhận bài, Idempotency replay, kiểm tra deadline
│   │
│   └── grading/                    # Module Chấm bài & Phân tích Ràng buộc C++
│       └── service/
│           ├── constraint-judge.js # Adapter LLM (Gemini), Zod schema parser & fallback unsure
│           ├── cpp-tokens.js       # Phân tích từ vựng C++ (tokenizer)
│           ├── hard-rules.js       # Phân tách ràng buộc cứng (AST/Token) và ràng buộc ngữ nghĩa (LLM)
│           └── sanitize.js         # Xóa comment C++ chống prompt injection & ẩn danh hóa thông tin sinh viên
│
└── shared/                         # Thư viện tiện ích dùng chung
    ├── db.js                       # Quản lý connection pool PostgreSQL (pg.Pool)
    ├── problems.js                 # Định nghĩa ProblemError & hàm gửi lỗi RFC 9457
    └── validation.js               # Tiện ích validate request body bằng Zod (parseBody)
```

---

## 3. Quy tắc phụ thuộc giữa các tầng (Layer Import Rules)

Để tránh hiện tượng phụ thuộc vòng (circular dependency) hoặc rò rỉ chi tiết cài đặt, mã nguồn trong `src/` tuân thủ nghiêm ngặt ma trận quyền import (được kiểm tra tự động bởi ESLint):

| Tầng (Layer)            | Được phép import                                         | Tuyệt đối KHÔNG được import                                                                  |
| :---------------------- | :------------------------------------------------------- | :------------------------------------------------------------------------------------------- |
| **`*.routes.js`**       | Controller tương ứng, `src/middlewares/`, `express`      | Services, Repositories, thư viện `pg`                                                        |
| **`middlewares/`**      | `express`, `src/shared/`, token helpers trong auth       | Service classes, Repositories, Controllers, Routes, `pg`                                     |
| **`*.controller.js`**   | Services, `src/shared/`, `zod`                           | Repositories, Routes, thư viện `pg`                                                          |
| **`*.service.js`**      | Repository Interfaces, `src/shared/`, `grading/service/` | `express`, Controllers, Routes, `pg`, concrete repositories (`*.postgres.js`, `*.memory.js`) |
| **`*.repository.*`**    | `pg` (chỉ với postgres), `src/shared/`                   | `express`, Services, Controllers, Routes                                                     |
| **Tất cả các nơi khác** | —                                                        | Không được import trực tiếp `*.repository.postgres.js` hoặc `*.repository.memory.js`         |

> **Quy tắc vàng:** Chỉ duy nhất `src/container.js` được phép import các repository cụ thể (`*.postgres.js`, `*.memory.js`) và gọi lệnh `new` để lắp ráp chúng.

---

## 4. Vòng đời xử lý một Request (Request Lifecycle)

Sơ đồ tuần tự xử lý một yêu cầu nộp bài mẫu (`POST /labs/:labId/submissions`):

```
Client (HTTP Request)
  │
  ▼
[src/server.js] (Lắng nghe cổng HTTP)
  │
  ▼
[src/app.js]
  │──► [middlewares/request-context] : Sinh x-request-id UUID, gán req.log (pino child logger)
  │
  ▼
[modules/submissions/controller/submissions.routes.js]
  │──► [middlewares/require-auth]     : Kiểm tra Bearer JWT -> gán res.locals.user
  │──► [middlewares/require-role]     : Kiểm tra role === 'student' (chặn TA/Admin: 403)
  │──► [middlewares/json-body]        : Parse JSON body, giới hạn payload <= 256 KiB
  │──► [middlewares/idempotency-key]  : Kiểm tra định dạng và độ dài header Idempotency-Key
  │
  ▼
[modules/submissions/controller/submissions.controller.js]
  │──► Parse & validate body { language: 'cpp', source: string } bằng Zod
  │──► Gọi SubmissionsService.submit(...)
  │
  ▼
[modules/submissions/service/submissions.service.js]
  │──► Tìm Lab qua LabRepository.findForStudent (nếu không thấy -> 404 lab-not-found)
  │──► Tính SHA-256 fingerprint của source code
  │──► Kiểm tra Idempotency qua SubmissionRepository.findByIdempotencyKey:
  │       ├── Nếu đã có & trùng body -> Replay bài cũ (kèm header Idempotent-Replayed: true)
  │       └── Nếu đã có & khác body  -> Ném lỗi 422 idempotency-key-reused
  │──► Kiểm tra deadline (nếu quá hạn -> 409 lab-closed)
  │──► Lưu bài nộp qua SubmissionRepository.insertIfAbsent (status: 'queued')
  │
  ▼
[modules/submissions/repository/submissions.repository.postgres.js]
  │──► Thực thi SQL: INSERT INTO submissions ... ON CONFLICT (...) DO NOTHING
  │
  ▼
Client nhận phản hồi HTTP `202 Accepted` (kèm header `Location: /submissions/:id`)
```

_Nếu xảy ra bất kỳ ngoại lệ nào:_ Lỗi được bắt bởi `src/middlewares/error-handler.middleware.js` để chuyển thành phản hồi JSON RFC 9457 an toàn, không làm rò rỉ stack trace hoặc dữ liệu nhạy cảm.

---

## 5. Cấu hình biến môi trường (`src/config.js`)

Mọi cấu hình môi trường được đọc và kiểm tra tính hợp lệ duy nhất một lần khi khởi động thông qua hàm `loadConfig()` trong [src/config.js](file:///home/harry/Documents/Course/advanced-web/final-project/LeetKOB/src/config.js):

| Biến môi trường | Bắt buộc | Mặc định | Ý nghĩa & Quy chuẩn kiểm tra                                                                            |
| :-------------- | :------: | :------: | :------------------------------------------------------------------------------------------------------ |
| `JWT_SECRET`    |  **Có**  |    —     | Khóa bí mật dùng để ký và xác thực JWT token (tối thiểu 32 ký tự).                                      |
| `DATABASE_URL`  |  **Có**  |    —     | Chuỗi kết nối PostgreSQL (ví dụ: `postgresql://postgres:postgres@localhost:5432/leetkob`).              |
| `PORT`          |  Không   |  `3000`  | Cổng HTTP mà server lắng nghe (số nguyên từ `1` đến `65535`).                                           |
| `LOG_LEVEL`     |  Không   | `'info'` | Mức độ ghi log của `pino` (`'fatal'`, `'error'`, `'warn'`, `'info'`, `'debug'`, `'trace'`, `'silent'`). |

---

## 6. Hướng dẫn phát triển & Mở rộng (Developer Guide)

### Cách thêm một Feature / Module mới vào hệ thống:

Khi cần bổ sung tính năng mới, hãy thực hiện tuần tự theo các bước chuẩn mực:

1. **Tạo cấu trúc thư mục module:**
   Tạo thư mục `src/modules/<feature-name>/` với 3 thư mục con: `controller/`, `service/`, `repository/`.
2. **Định nghĩa Repository Interface & Implementations:**
   - Tạo `<feature>.repository.js`: Chỉ chứa định nghĩa JSDoc typedefs mô tả các phương thức lưu trữ (`export {}`).
   - Tạo `<feature>.repository.memory.js`: Hiện thực phiên bản lưu trữ trên RAM phục vụ testing.
   - Tạo `<feature>.repository.postgres.js`: Hiện thực phiên bản SQL thuần tương tác với PostgreSQL qua `pg.Pool`.
3. **Viết Service:**
   Tạo `<feature>.service.js`: Nhận repository qua constructor injection, hiện thực toàn bộ quy tắc nghiệp vụ. Khi có lỗi, ném `new ProblemError('<slug>', 'chi tiết')`.
4. **Viết Controller & Routes:**
   - Tạo `<feature>.controller.js`: Dùng `parseBody(schema, req.body)` để kiểm tra dữ liệu đầu vào.
   - Tạo `<feature>.routes.js`: Tạo router Express, gắn middleware bảo vệ (`requireAuth`, `requireRole`, `jsonBody`).
5. **Đăng ký vào Container & App:**
   - Mở `src/container.js`: Thêm repository, service và controller mới vào hàm `createContainer`.
   - Mở `src/app.js`: Mount router mới vào ứng dụng Express.
6. **Kiểm tra chất lượng (Quality Gate):**
   Chạy lệnh kiểm tra tổng thể để đảm bảo mã nguồn mới tuân thủ 100% quy chuẩn kiến trúc và vượt qua toàn bộ tests:
   ```bash
   npm run check
   ```
