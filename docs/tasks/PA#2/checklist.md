### **Checklist Thực Hiện PA#2 — Harness and Quality Gate**

**Lưu ý quan trọng:** sau khi hoàn thành các task của mỗi thành viên, hãy báo cáo (mình đã làm gì và minh chứng kèm theo (link, ...)) ở trong file của folder "/docs/tasks/proof-report/PA#2"

**Giai đoạn 1: Khởi tạo Repository & Cấu hình AI Rules (Tiêu chí 1 & 7)**

- [x] Khởi tạo Public Repository trên GitHub cho LeeTKOB - Dương
- [x] Khởi tạo file `AGENTS.md` ở thư mục gốc chứa 4 phần: Stack, Commands, Conventions, và Never - Dương
- [x] Ghi rõ trong mục **Never** của `AGENTS.md`: _Tuyệt đối không đưa API key của model vào sandbox, kể cả trong biến môi trường_ - Dương
- [x] Ghi rõ trong mục **Never** của `AGENTS.md`: _Không gọi API model thật trong quá trình chạy Unit Test_ - Dương
- [x] Ghi rõ trong mục **Never** của `AGENTS.md`: _Không chỉnh sửa file test, dữ liệu evaluation (dev set) hay nhãn để CI báo pass_ - Dương

- [ ] Tạo file `CLAUDE.md`, `.github/copilot-instructions.md`, và `.cursor/rules/main.mdc`. Thêm dòng lệnh yêu cầu các Agent phải đọc file `AGENTS.md` trước khi code

* Quang Vinh: Sử dụng CLAUDE.md để gen file CLAUDE.md (rule dành riêng cho CLAUDE khi sử dụng nó làm Coding Agent)
* Quang Vinh và Thế Vinh: Đưa ra nhận xét file `AGENTS.md` được đề xuất; đưa ra tech stack kèm theo lý do chọn techstack đó để áp dụng cho dự án;

- [ ] Bắt buộc các thành viên: Mỗi khi AI đề xuất code, phải ghi chép lại vào `AI-LOG.md` (bao gồm công cụ sử dụng, phần việc đã làm, và các đề xuất được chấp nhận (Changed) hoặc bị từ chối (Rejected)).

**Giai đoạn 2: Quản lý Secret & Biến Môi Trường (Tiêu chí 2)** - Quang Vinh

- [x] Cập nhật file `.gitignore` để chắc chắn bỏ qua các file `.env`.

- [x] Khởi tạo file `.env.example` liệt kê toàn bộ các biến môi trường cần thiết (ví dụ: Port, Database URL, API Key) nhưng **để trống giá trị**.

- [ ] Thiết lập hạn mức chi tiêu (spending cap) cho Model API trên bảng điều khiển của nhà cung cấp.

- [ ] Cập nhật `README.md`: Khai báo loại Model đang dùng và ghi rõ hạn mức chi tiêu đã cài đặt. _(README đã có mục, còn chờ chốt model + số tiền cap)_

- [x] Kiểm tra lịch sử Git: Đảm bảo chưa từng có commit nào chứa mật khẩu hoặc API Key. (Nếu lỡ commit, hãy rotate key và ghi nhận cách xử lý vào `AI-LOG.md`).

- [x] Cập nhật file phân quyền (Permissions): Phân loại rõ các hành động AI được phép làm (Allowed), phải hỏi trước (Ask first), và tuyệt đối cấm (Never).

**Giai đoạn 3: Cấu hình Công cụ Kiểm tra (Tiêu chí 3)** - Quang Vinh

- [x] Cấu hình công cụ Lint (ví dụ: ESLint).

- [x] Cấu hình công cụ Format (ví dụ: Prettier).

- [x] Cấu hình công cụ Type Check (nếu stack sử dụng TypeScript, C#...).

- [x] Thiết lập **một lệnh duy nhất** (ví dụ: `npm run check`) trong `package.json` hoặc Makefile để chạy đồng thời cả Lint, Format, Type Check và Test.

- [x] Cập nhật `README.md` hướng dẫn cách chạy lệnh kiểm tra này.

**Giai đoạn 4: Thiết lập CI & Branch Protection (Tiêu chí 4)** - Dương làm

- [x] Tạo file `.github/workflows/ci.yml` chạy `npm ci` rồi `npm run check` mỗi khi có Pull Request.

- [x] Bật tính năng "Branch Protection" cho nhánh `main` trên GitHub Settings.

- [ ] Đặt pipeline CI vừa tạo thành "Required status checks" để chặn tính năng Merge nếu CI báo đỏ (fail). Branch protection đã bật theo xác nhận; chưa xác nhận context `quality` do GitHub API từ chối quyền đọc.

- [ ] Test CI: Tạo một nhánh mới, push một đoạn code vi phạm Lint/Format, tạo PR và chụp ảnh màn hình PR bị chặn lại bởi CI đỏ. Đã có [PR #6](https://github.com/AWAD-2Vinh-1Duong/LeetKOB/pull/6) và [CI đỏ](https://github.com/AWAD-2Vinh-1Duong/LeetKOB/actions/runs/41222159341); chưa lưu ảnh chụp.
- [ ] Sửa lỗi trên nhánh đó, commit để CI chuyển sang xanh và merge PR. Lưu lại các link PR này để nộp bài. Đã có [CI xanh](https://github.com/AWAD-2Vinh-1Duong/LeetKOB/actions/runs/41222245456); PR đang mở, chưa merge.

**Giai đoạn 5: Hoàn thiện Hợp đồng Endpoint (Tiêu chí 5)**

- [ ] Chọn **1 endpoint duy nhất** có mức độ rủi ro cao (Khuyến nghị: `POST /labs/{labId}/submissions` hoặc `GET /labs/{labId}/review-queue`).

- [ ] Khởi tạo file `docs/contract/<endpoint>.md`.

- [ ] Khai báo rõ ràng: **Ai có quyền gọi** (Role & Ownership).

- [ ] Xác định cấu trúc Request & Response kèm quy tắc xác thực cho từng trường.

- [ ] Định nghĩa toàn bộ các lỗi có thể xảy ra theo chuẩn **RFC 9457 Problem Details**, kèm theo Status Code tương ứng.

- [ ] Bắt buộc: Cấu hình cơ chế Phân trang (Paging) nếu là API GET list, hoặc Idempotency nếu là API POST/Tạo mới tài nguyên.

**Giai đoạn 6: Triển khai Contract Tests (Tiêu chí 6)**

- [ ] Viết Contract Test trong thư mục `tests/contract/` bao phủ mọi loại lỗi, quy tắc sở hữu (ownership), và xử lý phân trang/idempotency đã định nghĩa trong file contract.

- [ ] Cấu hình để Contract Test được chạy chung với bộ lệnh Test trong CI.

- [ ] Thực hiện bắt buộc: Cố tình viết sai code để vi phạm contract, push lên tạo PR để CI báo đỏ (deliberate break). Lưu lại link PR.

- [ ] Sửa lại logic code cho đúng, commit để CI xanh trở lại. Lưu lại link commit này.

**Giai đoạn 7: Đóng gói & Nộp bài (Tiêu chí 7 & Quy định chung)** - Bình Dương l

- [ ] Hoàn tất file `AI-LOG.md` với ít nhất 2 mục Changed/Rejected có nguồn gốc từ sự cố thực tế xảy ra trong lúc code.

- [ ] Chụp màn hình phần thiết lập Branch Protection của nhánh `main`.

- [ ] Cập nhật file `PA2.md` với các đường link: Repo (để public), Ảnh Branch Protection, PR bị chặn, PR xanh, Link CI run của tag, và link PR vi phạm contract (deliberate break).

- [ ] Hoàn thiện file `SELF_ASSESSMENT_REPORT.md`: Tự chấm điểm từng tiêu chí, gắn link bằng chứng, và ghi chú phần "what we did not manage".

- [ ] Commit mọi thứ. Tạo tag `pa2` và push tag lên repository: `git tag pa2 && git push origin pa2`.

- [ ] Nén toàn bộ thư mục (Bao gồm cả file `.git`) thành file zip. Đặt tên file theo cấu trúc: `<MSSV1>-<MSSV2>-<MSSV3>_<Tổng_điểm>.zip` xếp theo thứ tự tăng dần của MSSV (Ví dụ: `23120242-23120255-23120262_98.zip`).

- [ ] Một thành viên đại diện dùng email sinh viên gửi bài nộp trước **22:00, Thứ Tư, 11/11/2026**.
