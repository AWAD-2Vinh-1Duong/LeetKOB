# AI Log

Khi ghi AI Log thì phải ghi ở trên cùng.

## 2026-11-08 — Kiểm tra bài nộp PA#2 và sửa minh chứng (Quang Vinh)

Tool: Claude Code (Claude Opus 5.5)
Asked for: Audit the PA#2 submission folder against the rubric, then fix every problem found.
Kept: Corrected `PA2.md` links (the commit and run that turned PR #6 green; the tag-run list instead of a run on the tag's earlier commit), `.gitleaksignore` for one false positive, the missing 2026-10-31 AI-LOG entry and the `2026-29-10` date fixes.
Changed: The audit found that `main` required no status check, although `SELF_ASSESSMENT_REPORT.md` said the team confirmed it did: the API returned `"contexts": []` and our own screenshot read "No required checks". We added `quality` as a required check and replaced the claim with the new screenshot. The model was changed from Gemini 1.5 Flash, shut down by Google in September 2025, to Gemini 3.6 Flash.
Rejected: An API key pasted into the chat to test which models it can call. Tier 3 of `AGENTS.md` forbids putting a secret in a chat or a command, so the assistant gave a command that reads the key from `.env` instead, and the key is to be rotated.

## 2026-11-07 — Bật CI cho tag pa2

Tool: GitHub Copilot
Asked for: Cấu hình workflow hiện tại để quality job cũng chạy khi tag pa2 được push.
Kept: Giữ trigger pull request và quality job hiện có; thêm trigger push cho tag pa2.
Changed: No
Rejected: No

## 2026-11-07 — Cập nhật mô tả Free tier trong README

Tool: GitHub Copilot
Asked for: Sửa README để mô tả đúng việc chỉ sử dụng Gemini Free tier và chưa bật billing/spending cap.
Kept: Ghi rõ khoản trả trước 800.000 VNĐ theo thông tin nhóm cung cấp, trạng thái billing chưa bật, và quota Free tier.
Changed: No
Rejected: No

## 2026-11-07 — Cập nhật self-assessment theo xác nhận của nhóm

Tool: GitHub Copilot
Asked for: Cập nhật điểm và minh chứng self-assessment theo giải thích của nhóm về branch protection, Free tier và tag pa2.
Kept: Ghi nhận run 41223080718 là xanh theo xác nhận của nhóm; ghi rõ Free tier được giữ để tránh khoản trả trước 800.000 VNĐ.
Changed: No
Rejected: No

---

## 2026-11-07 — Hoàn thiện self-assessment PA#2

Tool: GitHub Copilot
Asked for: Điền báo cáo self-assessment PA#2 theo rubric, dùng minh chứng có thật và đánh dấu phần chưa xác minh.
Kept: Dùng điểm và liên kết dựa trên nội dung hiện có trong repository; để placeholder cho minh chứng còn thiếu hoặc mâu thuẫn.
Changed: No
Rejected: No

## 2026-11-01 — Contract và contract tests cho POST /labs/{labId}/submissions (PA#2, Thế Vinh)

Tool: Claude Code (Claude Opus 5.5)
Asked for: Write the contract for `POST /labs/{labId}/submissions`, contract tests that assert the RFC 9457 body, the minimal code to pass them, and a deliberate break on a `gate/*` branch.
Kept: The contract (role, enrollment ownership with 404, idempotency scope per student and lab, 9 problem types, order of checks), 31 tests in `tests/contract/`, and the in-memory repository behind constructor DI, marked `shortcut:` until PA#3.
Changed: No
Rejected: No

## 2026-10-31 — Sửa lỗi định dạng tài liệu CI - Dương

Tool: GitHub Copilot
Asked for: Fix the Prettier failures reported for `docs/tasks/PA#2/checklist.md` and `PA2.md` in the CI run.
Kept: Ran Prettier on the two reported files and confirmed the full `npm run check` passes.
Changed: No
Rejected: No

## 2026-10-31 — Thiết lập và kiểm chứng CI (PA#2 - Dương)

Tool: GitHub Copilot
Asked for: Complete the CI and branch-protection tasks in Giai đoạn 4 and verify a deliberate red-to-green pull request.
Kept: Added the pull-request workflow and verified PR #6 failed on the deliberate lint error, then passed after the fix.
Changed: No
Rejected: No

## 2026-10-31 — Cập nhật luật Agent và README (PA#2, Bình Dương)

Tool: GitHub Copilot
Asked for: Update `AGENTS.md` from the PA#2 review and document Gemini 1.5 Flash free tier with a 1 USD/month cap in `README.md`.
Kept: Chose the concrete stack from the review and applied its CI, eval, RFC 9457, and idempotency recommendations.
Changed: No
Rejected: No

## 2026-10-31 — Review AGENTS.md and choose the tech stack (PA#2, Thế Vinh)

Tool: DeepSeek V4.1 Flash Free (OpenCode)
Asked for: Review the AGENTS.md draft against the PA#2 rubric and propose a tech stack with reasons.
Kept: The three permission tiers, the completed sandbox never line and npm as the package manager — all match the rubric, so they were left untouched.
Changed: Wrote the review as a separate file instead of editing AGENTS.md, which is Quang Vinh's deliverable. In that file, replaced the "Example Stack / Microservices / 3-tier / ???" placeholder with a concrete stack, and chose JavaScript + checkJs over TypeScript because package.json, tsconfig.json and the test glob are already wired for it.
Rejected: Rejected rewriting AGENTS.md directly. Rejected treating the 0-byte ci.yml as a gate: an empty workflow always passes, the exact case rubric 7 warns about. Rejected Redis, Prisma, Jest and Judge0 — reasons in the stack table.

## 2026-10-31 — CLAUDE.md, secrets và công cụ kiểm tra (PA#2, Quang Vinh)

Tool: Claude Code (Claude Opus 5.5)
Asked for: Write `CLAUDE.md`, then complete Giai đoạn 2 (`.env.example`, permission tiers, secret scan) and Giai đoạn 3 (lint, format, type check and one `npm run check` command).
Kept: `CLAUDE.md` importing `@AGENTS.md`; ESLint 10, Prettier 3, `tsc --noEmit` with `checkJs` and `node --test` chained in `npm run check`; `.env.example` with every value empty; a gitleaks scan of the whole history.
Changed: The first `CLAUDE.md` the assistant wrote failed `prettier --check`; it was reformatted and "Format before committing" became a rule in `CLAUDE.md`. `README.md` said a spending cap "Đã thiết lập" although none existed; that line was changed to a TODO.
Rejected: `npm audit fix --force`, which would have downgraded ESLint 10 to 4 to silence a dev-only `minimatch` advisory. Rejected treating `npm test` as a gate while `tests/` was empty: `node --test` exits 0 when it finds no test files, so the step could not fail until contract tests existed.

## 2026-10-30 — Thiết lập CI chặn merge

Tool: GitHub Copilot
Asked for: Thiết lập workflow CI cho pull request, chuẩn bị nhánh thử lint/format đỏ và chuyển các lệnh hướng dẫn từ pnpm sang npm.
Kept: Dùng `npm run check` làm lệnh kiểm tra duy nhất trong workflow theo hướng dẫn tại `AGENTS.md`.
Changed: Đổi các lệnh trong `AGENTS.md` và `README.md` sang npm; thêm workflow `.github/workflows/ci.yml`; tạo nhánh `gate/ci-test` và thêm đoạn mã cố ý vi phạm lint/format vào `src/app.js`.
Rejected: Không thêm `package.json`, script kiểm tra hay cấu hình lint/format vì nằm ngoài phạm vi bước được yêu cầu. `npm run check` hiện không chạy được do repository chưa có `package.json`; chưa có PR hoặc ảnh CI vì chưa commit/push.

## 2026-10-29 - Adjust the AGENTS.md (PA#2, Bình Dương)

Tool: Gemini 4 Argon - Medium
Asked for: Adjusting the content of the AGENTS.md which is generated before (in session 3, including 4 parts: Stack, Commands, Conventions, và Never)
Kept: Kept all the content, excluding the "stack" which is need to be further researched and disscused with team
Changed: Adjust the "stack" to "example stack"
Rejected: Didn't reject any content

## 2026-10-29 - Tạo file quản lý công việc (PA#2, Bình Dương)

Tool: Gemini 3.1 Pro - Medium
Asked for: Based on the Rubric and Requirement file, create a checklist.md includes all the tasks which are needed to completed for PA#2
Kept: Keeping the content of checklist which is generated
Changed: adjust some task status from "not done" ([ ]) to "done ([x])
Rejected: Didn't reject any content

## 2026-10-29 - Tạo cấu trúc file (PA#2, Bình Dương)

Tool: MAI Code 1.1 FLASH (Auto copilot)
Asked for: Setting up the file structure for the repository (includes AI's rules files, /src, /docs, /tests, ...)
Kept: Use the structure which given by AI
Changed: add some rules file such as: "AGENTS.md", "CLAUDE.md", ".github/copilot-instructions.md"
Rejected: Didn't reject any content
