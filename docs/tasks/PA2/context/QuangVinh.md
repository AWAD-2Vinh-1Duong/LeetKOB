# Proof report PA#2 — Quang Vinh

Phụ trách: `CLAUDE.md`, **Giai đoạn 2** (Secret & biến môi trường — Tiêu chí 2) và **Giai đoạn 3** (Công cụ kiểm tra — Tiêu chí 3).

Repo: https://github.com/AWAD-2Vinh-1Duong/LeetKOB

## 1. `CLAUDE.md` (Tiêu chí 1)

| Việc                                                                                                             | Minh chứng                                                                            |
| ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Tạo `CLAUDE.md`, dòng đầu `@AGENTS.md` để Claude Code nạp luật chung trước (theo tài liệu chính thức)            | [`c547c73`](https://github.com/AWAD-2Vinh-1Duong/LeetKOB/commit/c547c73), `CLAUDE.md` |
| 4 luật "có câu chuyện" truy được về sự cố thật: commit `cfcb089`, entry AI-LOG 2026-10-30, `AI-RULES.md`, `pnpm` | `CLAUDE.md` mục _Rules with a story_                                                  |

## 2. Giai đoạn 2 — Secret & biến môi trường (Tiêu chí 2)

| Việc                                                                                                                                                                  | Minh chứng                                                                               |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `.gitignore` bỏ qua `.env`, `.env.*` (giữ `.env.example`), thêm `node_modules/`                                                                                       | `.gitignore`, [`4dd88b1`](https://github.com/AWAD-2Vinh-1Duong/LeetKOB/commit/4dd88b1)   |
| `.env.example` liệt kê mọi biến, **tất cả để trống**; tách nhóm `LLM_*` (chỉ app) và `SANDBOX_*` (chỉ giới hạn)                                                       | `.env.example`, [`8a5f987`](https://github.com/AWAD-2Vinh-1Duong/LeetKOB/commit/8a5f987) |
| Quét secret toàn bộ lịch sử mọi nhánh bằng gitleaks 8.18.4: `11 commits scanned … no leaks found` (2026-10-31)                                                        | Lệnh và kết quả ghi trong `README.md` mục 3                                              |
| Phân quyền 3 tầng trong `AGENTS.md`: sửa Tier 1 (`pnpm` → `npm`), thêm vào Tier 3 cấm đọc/in `.env` và cấm đổi spending cap; viết lại dòng Never bị cắt dở về sandbox | [`6ee9be4`](https://github.com/AWAD-2Vinh-1Duong/LeetKOB/commit/6ee9be4)                 |
| README mục 3: phân quyền, biến môi trường, secret scan, spending cap                                                                                                  | [`31e740d`](https://github.com/AWAD-2Vinh-1Duong/LeetKOB/commit/31e740d)                 |

**Chưa xong:** chọn model và đặt spending cap trên dashboard của provider (chờ nhóm chốt model). Khi xong: chụp màn hình, điền số tiền vào `README.md` mục 3.

## 3. Giai đoạn 3 — Công cụ kiểm tra (Tiêu chí 3)

| Việc                                                                                                                     | Minh chứng                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| ESLint 10 (`no-console` trong `src/`), Prettier 3, `tsc --noEmit` với `checkJs`, `node --test`                           | `eslint.config.js`, `.prettierrc.json`, `tsconfig.json`, [`4dd88b1`](https://github.com/AWAD-2Vinh-1Duong/LeetKOB/commit/4dd88b1) |
| Một lệnh chạy tất cả: `npm run check` (lint → format:check → typecheck → test)                                           | `package.json`                                                                                                                    |
| Format các file `.md` của nhóm; đã kiểm tra nội dung chữ không đổi (chỉ đổi ký hiệu và xuống dòng)                       | [`613276c`](https://github.com/AWAD-2Vinh-1Duong/LeetKOB/commit/613276c)                                                          |
| README: yêu cầu Node >= 22, `npm ci`, CI phải chạy đúng `npm ci` + `npm run check`                                       | [`31e740d`](https://github.com/AWAD-2Vinh-1Duong/LeetKOB/commit/31e740d)                                                          |
| Kiểm chứng: clone mới → `npm ci` → `npm run check`. Chỉ đỏ vì dòng cố tình sai trong `src/app.js`; bỏ dòng đó thì exit 0 | Chạy ngày 2026-10-31                                                                                                              |

**Lưu ý cho nhóm:**

- `npm test` với 0 test vẫn trả exit 0 → phải có contract test thật (Giai đoạn 6) trước khi đặt check này là required, nếu không CI "không thể fail".
- Giữ dòng cố tình sai trong `src/app.js` đến khi Dương có `ci.yml` + branch protection, rồi dùng nó làm PR đỏ → commit xanh (Tiêu chí 4).
