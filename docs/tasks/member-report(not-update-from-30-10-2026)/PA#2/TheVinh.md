# Proof report PA#2 — Thế Vinh

Phụ trách: **Giai đoạn 1** — nhận xét `AGENTS.md` được đề xuất và chốt tech stack (cùng Quang Vinh).

Repo: https://github.com/AWAD-2Vinh-1Duong/LeetKOB

Công cụ: OpenCode + DeepSeek V4.1 Flash để soạn bản nháp; các kết luận và lựa chọn stack đã đọc lại và chốt trước khi commit.

## 1. Nhận xét `AGENTS.md` (Tiêu chí 1)

| Việc                                                                                                                                                                                                                                       | Minh chứng                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------- |
| Đọc toàn bộ `docs/` (brief, rubric, requirement, checklist) và đối chiếu `AGENTS.md` với 7 tiêu chí                                                                                                                                        | `docs/tasks/PA#2/AGENTS-review-and-tech-stack.md` mục 1 |
| Chỉ ra 12 vấn đề kèm mức độ và cách sửa: stack còn `???`, dấu `.` lơ lửng ở `Architectural Flow`, `npm run check` đang đỏ vì `src/app.js`, `ci.yml` 0 byte, thiếu luật eval/CI, Tier 1 vs Tier 3 xung đột, chưa có quy ước `type` RFC 9457 | cùng file, bảng 1.2                                     |
| Soạn 2 dòng "có câu chuyện" để dán vào `AGENTS.md`, dẫn đúng commit `cfcb089` và entry AI-LOG 2026-10-30 (rubric 1 đòi ≥2)                                                                                                                 | cùng file, mục 1.3                                      |
| Ghi lại phiên làm việc vào `AI-LOG.md` theo template                                                                                                                                                                                       | `AI-LOG.md`, entry 2026-10-31                           |

## 2. Tech stack (Tiêu chí 1)

| Việc                                                                                                                                     | Minh chứng                                |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| Chốt stack: Node 22 + JavaScript (`checkJs`) + Express 5 + PostgreSQL 16 + npm, một process, 3 lớp                                       | `AGENTS-review-and-tech-stack.md` mục 2.1 |
| Nêu lý do cho 4 quyết định lớn: monolith, JS + `checkJs`, Postgres làm queue, Docker runner tự viết                                      | cùng file, mục 2.2                        |
| Loại 10 phương án kèm lý do: microservices, TypeScript, Prisma/TypeORM, Redis/BullMQ, Jest, Judge0, MongoDB, SQLite, argon2/bcrypt, pnpm | cùng file, mục 2.3                        |
| Nêu cái giá/rủi ro và 6 điều kiện để stack chạy thật                                                                                     | cùng file, mục 2.4–2.5                    |

## 3. Git & PR

| Việc                                                     | Minh chứng                                                               |
| -------------------------------------------------------- | ------------------------------------------------------------------------ |
| Commit tài liệu + AI-LOG trên nhánh `feat/agents-review` | [`6cdff28`](https://github.com/AWAD-2Vinh-1Duong/LeetKOB/commit/6cdff28) |
| PR #3, đã merge vào `main`                               | https://github.com/AWAD-2Vinh-1Duong/LeetKOB/pull/3                      |
| Merge commit                                             | [`2da4b20`](https://github.com/AWAD-2Vinh-1Duong/LeetKOB/commit/2da4b20) |

## Chưa xong / bàn giao

- **Quang Vinh** áp các sửa vào `AGENTS.md`: thay stack `???`, xoá dấu `.`, thêm luật eval + CI, thêm 2 dòng dẫn chứng, thêm "Tier 3 overrides Tier 1 and Tier 2", quy ước `type` cho RFC 9457.
- **Nhóm** chốt model + spending cap; `README.md` mục 3 vẫn đang TODO.
- `main` chưa bật branch protection và `ci.yml` vẫn 0 byte — thuộc Giai đoạn 4 (Dương), không nằm trong phần này.
- Bản nhận xét dựa trên `AGENTS.md` tại commit `6ee9be4`; nếu file đổi sau đó thì phải đọc lại trước khi áp.
