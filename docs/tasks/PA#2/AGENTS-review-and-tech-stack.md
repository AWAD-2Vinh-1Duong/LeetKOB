# PA#2 — Nhận xét `AGENTS.md` (bản Quang Vinh) và chốt tech stack

Ngày: 2026-10-31. Phạm vi: nhận xét file luật và chốt stack. **Không sửa `AGENTS.md`** — file này là phần việc của Quang Vinh; các đề xuất dưới đây để bạn ấy tự áp.

## TL;DR

- Bản mới đã sửa 3 lỗi nặng của bản trước: never list về sandbox đã đủ, có đủ 3 tầng quyền, npm đã thống nhất toàn repo.
- Còn 4 thứ chặn rubric: stack vẫn `???`, một dấu `.` lơ lửng ở dòng 34, `npm run check` đang đỏ vì `src/app.js` trên `main`, và `ci.yml` rỗng 0 byte.
- Stack chốt: **Node 22 + JavaScript (`checkJs`) + Express 5 + PostgreSQL 16 + npm**.

## 1. Nhận xét `AGENTS.md`

### 1.1 Đã tốt

- Mục 5 có đủ 3 tầng allowed / ask first / never — đúng tiêu chí 2, hơn hẳn bản trước.
- Dòng 49 nói đủ 5 minimum của sandbox và chặn luôn việc nới giới hạn để test xanh — đúng câu chữ của brief.
- Ngoại lệ default export cho `eslint.config.js` là chi tiết thực tế, chứng tỏ luật được chỉnh sau khi chạy thật.
- npm được dùng nhất quán ở mục 2, 5 và `CLAUDE.md`; không còn pnpm lẫn lộn.

### 1.2 Vấn đề

| # | Dòng | Vấn đề | Mức | Đề xuất |
| --- | --- | --- | --- | --- |
| 1 | 7–14 | `Example Stack`, `Microservices/ 3-tier/ ???` — chưa quyết, nhưng đầu file bảo agent "strictly follow" | Cao | Thay bằng bảng stack ở mục 2 |
| 2 | 34 | `**Architectural Flow:** . Controllers...` — dấu chấm lơ lửng, đọc như câu bị xoá đầu | Cao | Xoá `. ` sau dấu hai chấm |
| 3 | 22–28 | `npm run check` hiện **đỏ**: `src/app.js` là dòng cố ý vi phạm, đã commit lên `main` ở `cfcb089` | Cao | Chuyển dòng đó sang nhánh `gate/ci-test`, trả `main` về xanh trước khi nộp |
| 4 | 47 | Never chỉ nói unit/contract test, không nói eval — PA#4 chạy eval trong CI sẽ gọi model thật | Cao | Thêm "eval replays recorded fixtures; live run là lệnh tay" |
| 5 | 44–51 | Thiếu luật "CI step không thể fail"; `ci.yml` đang 0 byte, mà AI-LOG 2026-10-30 lại ghi là đã thêm | Cao | Thêm luật cấm `\|\| true`, `continue-on-error`, workflow rỗng |
| 6 | 57–84 | Tier 1 cho "Read files", Tier 3 cấm đọc `.env` — không nói tầng nào thắng | Vừa | Thêm một dòng: "Tier 3 overrides Tier 1 and Tier 2" |
| 7 | 35 | RFC 9457 bắt có `type` nhưng không quy ước giá trị, mỗi endpoint sẽ tự bịa | Vừa | `https://leettkob.dev/problems/<slug>`, slug khai trong contract |
| 8 | 36 | Idempotency nói "respect" nhưng không nói lưu ở đâu | Vừa | Postgres + unique index, đặt ở repository |
| 9 | 14 | "extraneous libraries" không định nghĩa được — agent không biết ranh giới | Nhẹ | Runtime dependency phải hỏi; dev tooling đã có trong `package.json` thì được |
| 10 | 52–53 | Mục 5 thiếu `---` ngăn cách, khác 4 mục trên | Nhẹ | Thêm cho đồng bộ |
| 11 | toàn file | Chưa dòng nào dẫn được commit/AI-LOG; rubric 1 đòi ≥2 dòng có câu chuyện | Vừa | Dán 2 dòng ở mục 1.3 |
| 12 | README 117 | README nói `AGENTS.md` có 4 mục, thực tế 5 | Nhẹ | Sửa README (lỗi lệch tài liệu, không nằm trong `AGENTS.md`) |

### 1.3 Hai dòng nên dán vào `AGENTS.md` (rubric 1, band 13–15)

Mỗi dòng dẫn được một sự cố thật, đúng thứ rubric đòi:

```md
- **Deliberate breaks live only on `gate/*` branches.** A lint-breaking line meant for `gate/ci-test` landed on `main` (commit `cfcb089`, `src/app.js`). Check `git branch --show-current` before committing failing code.
- **Never claim a file or a CI step exists before opening it.** AI-LOG entry 2026-10-30 says `.github/workflows/ci.yml` was added; the committed file is 0 bytes. Open the file before writing the log line or the commit summary.
```

### 1.4 Đề xuất không áp dụng

- Không tách `PERMISSIONS.md`: 3 tầng đang nằm gọn trong mục 5, tách ra chỉ thêm file để agent bỏ sót.
- Không đổi npm về pnpm: `package-lock.json`, README và CI đã theo npm; đổi bây giờ là churn không có điểm.

## 2. Tech stack

### 2.1 Chốt

| Tầng | Chọn | Vì sao |
| --- | --- | --- |
| Runtime | Node.js 22 LTS, ESM | `package.json` đã `"type": "module"`, `engines >=22`; một ngôn ngữ cho HTTP, worker và driver sandbox |
| Ngôn ngữ | JavaScript + JSDoc, `checkJs` strict | `tsconfig.json` đã bật `allowJs`/`checkJs`/`strict`, `npm run typecheck` đã chạy `tsc --noEmit`; không cần build step |
| HTTP | Express 5 | Đã có trong luật; v5 tự bắt async error, middleware nhỏ |
| Kiến trúc | 1 process, 3 lớp controllers → services → repositories, DI qua constructor | 3 người, 5 tuần; brief nói ít moving part là lựa chọn hợp lệ |
| Database | PostgreSQL 16 + `pg`, SQL tay, migrate bằng `node-pg-migrate` | Một chỗ chứa user / lab / submission / queue / verdict / idempotency key |
| Queue | Bảng Postgres + `FOR UPDATE SKIP LOCKED` | 80 bài cùng lúc không cần thêm Redis; worker chạy trong cùng process |
| Validation | `zod` | Một schema dùng cho cả parse request và assert response trong contract test |
| Test | `node:test` + `supertest` | `npm test` đã dùng `node --test`; supertest gọi app Express thật |
| Lint / format | ESLint 10 flat + Prettier 3 | Đã cấu hình và đang chạy |
| Auth | JWT (`jose`) + `scrypt` của `node:crypto` | `.env.example` đã có `JWT_SECRET`; scrypt tránh native dependency |
| Sandbox | Docker runner tự viết | Mỗi minimum của brief map 1-1 với một flag và một attack test |
| LLM | Adapter `ConstraintJudge`, mặc định Gemini Flash free tier, mock trong test | Đổi provider không phải sửa service; free tier đủ cho 80 bài |
| Log | `pino` + request id | Structured, thay `console.log` đã bị cấm |
| Deploy | 1 VPS + docker compose (app, postgres, runner, Caddy) | PaaS free thường không cho nested Docker; compose đủ cho quy mô lớp |

### 2.2 Bốn quyết định đáng bảo vệ trong oral

**Một process, không microservices.** Đề xuất PA#1 là 3 service / 3 ngôn ngữ / 5 store. Với 3 người và 5 tuần, mỗi service thêm là thêm một chỗ deploy, một chỗ chết, một chỗ phải mock trong test. Brief nói rõ ít moving part là lựa chọn hợp lệ. Queue vẫn tách được về mặt logic (bảng riêng, worker riêng) mà không cần process riêng.

**JavaScript + `checkJs`, không TypeScript.** Repo đã có `tsconfig.json` với `allowJs`/`checkJs`/`strict` và script `typecheck`. Đổi sang TS bây giờ phải rename file, thêm runner (`tsx`), đổi glob test và cấu hình ESLint — đổi lấy lợi ích chưa cần trước PA#3. `checkJs` vẫn bắt được sai kiểu ở biên (request, response, verdict); shape phức tạp khai bằng JSDoc typedef trong `src/types.js`.

**Postgres làm queue.** `SELECT … FOR UPDATE SKIP LOCKED` cho đúng ngữ nghĩa "nhiều worker, không nhận trùng job" mà không thêm Redis. 80 submission đồng thời nằm gọn trong ngưỡng này. Đánh đổi: không scale tới hàng nghìn worker — ghi `shortcut:` trong code khi viết.

**Docker runner tự viết, không Judge0.** Brief bắt chứng minh từng minimum bằng một test tấn công thất bại. Tự viết thì mỗi minimum là một flag (`--network none`, `--memory`, `--cpus`, `--pids-limit`, `--read-only`, `--user`) và một test đọc được. Judge0 giấu các flag đó sau API của nó, khó chỉ vào để chứng minh.

### 2.3 Đã cân nhắc và loại

| Phương án | Vì sao loại |
| --- | --- |
| Microservices / 3 service | 3 người, 5 tuần; thêm deploy, thêm chỗ chết, thêm mock |
| TypeScript ngay bây giờ | Phải rename file, thêm runner, đổi glob test; chưa có code để hưởng lợi |
| Prisma / TypeORM | Giấu đúng phần SQL mà queue (`SKIP LOCKED`) và idempotency (unique index) cần viết tay |
| Redis + BullMQ | Thêm service, thêm secret, thêm chỗ chết; Postgres đã đủ cho 80 |
| Jest / Vitest | Thêm config và transform; `node:test` đã chạy |
| Judge0 self-host | Nặng, và khó chứng minh "không secret trong env" vì lớp đó nằm sau API của nó |
| MongoDB | Dữ liệu quan hệ: class → lab → submission → verdict → appeal |
| SQLite | Postgres đã có trong stack, và queue cần `SKIP LOCKED` |
| `argon2` / `bcrypt` | Native dependency, dễ vỡ CI; `scrypt` của `node:crypto` là đủ |
| pnpm | Đã chốt npm trong luật, README và lockfile |

### 2.4 Cái giá phải trả

- Thêm 6 dependency: `express`, `pg`, `zod`, `jose`, `pino` (runtime) và `supertest`, `node-pg-migrate` (dev). Mỗi lần thêm là một lần hỏi theo Tier 2.
- JWT không thu hồi được. Nếu cần khoá tài khoản, thêm cột `token_version` và so trong middleware.
- `checkJs` yếu hơn TS ở generic/union. Bù bằng `zod` ở biên và JSDoc typedef cho object nội bộ.
- Docker runner cần quyền socket. App **không** mount socket; runner là process riêng, container nó sinh ra không có socket, không env, `--network none`.
- Free tier model có rate limit → 429/timeout thành `unsure`, mà `unsure ≤ 20%` là ngưỡng cứng. Cần retry có giới hạn và cache theo (hash code, constraint).

### 2.5 Điều kiện để stack thành thật (chặn PA#2)

1. Đưa `src/app.js` về xanh trên `main`; dòng cố ý vi phạm chỉ sống trên `gate/*`.
2. Viết `ci.yml` thật: `npm ci` rồi `npm run check`, không `|| true`, không `continue-on-error`.
3. `npm i express pg zod jose pino` và `npm i -D supertest node-pg-migrate`.
4. Điền TODO trong README: model, spending cap, chi phí mỗi lab.
5. `docs/contract/post-labs-submissions.md` + `tests/contract/`.
6. Sửa README dòng 117: "4 mục" → "5 mục".

## 3. Câu hỏi cần team chốt

1. JavaScript + `checkJs` hay chuyển TypeScript ngay? Đề xuất JS, vì tooling hiện tại đã chạy được.
2. Model nào và cap bao nhiêu? Đề xuất Gemini Flash free tier, cap **5 USD/tháng**; phải điền vào README trước PA#3.
3. Deploy ở đâu? VPS hay PaaS — ảnh hưởng sandbox, quyết trước PA#5, không chặn PA#2.
