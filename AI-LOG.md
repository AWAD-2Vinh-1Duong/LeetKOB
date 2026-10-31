# AI Log

Khi ghi AI Log thì phải ghi ở trên cùng.

---

## Template for each Entry Log

```md
## <YYYY-MM-DD> — <what you were working on>

Tool: <Claude Code / Copilot / Cursor / something else / none>
Asked for: <the task you gave it, in one sentence>
Kept: <what you took as it came>
Changed: <what you rewrote, and why>
Rejected: <what you threw away, and why>
```

`Changed` and `Rejected` are the two lines we read most closely: what the assistant got wrong, and which check caught it. "Nothing went wrong" is a fine entry if it says what you ran.

---

## 2026-10-31 — Thiết lập và kiểm chứng CI (PA#2)

## 2026-10-31 — Sửa lỗi định dạng tài liệu CI

Tool: GitHub Copilot
Asked for: Fix the Prettier failures reported for `docs/tasks/PA#2/checklist.md` and `PA2.md` in the CI run.
Kept: Ran Prettier on the two reported files and confirmed the full `npm run check` passes.
Changed:
Rejected:

## 2026-10-31 — Thiết lập và kiểm chứng CI (PA#2)

Tool: GitHub Copilot
Asked for: Complete the CI and branch-protection tasks in Giai đoạn 4 and verify a deliberate red-to-green pull request.
Kept: Added the pull-request workflow and verified PR #6 failed on the deliberate lint error, then passed after the fix.
Changed:
Rejected:

## 2026-10-31 — Cập nhật luật Agent và README (PA#2, Bình Dương)

Tool: GitHub Copilot
Asked for: Update `AGENTS.md` from the PA#2 review and document Gemini 1.5 Flash free tier with a 1 USD/month cap in `README.md`.
Kept: Chose the concrete stack from the review and applied its CI, eval, RFC 9457, and idempotency recommendations.
Changed:
Rejected:

## 2026-10-31 — Review AGENTS.md and choose the tech stack (PA#2, Thế Vinh)

Tool: DeepSeek V4.1 Flash Free (OpenCode)
Asked for: Review the AGENTS.md draft against the PA#2 rubric and propose a tech stack with reasons.
Kept: The three permission tiers, the completed sandbox never line and npm as the package manager — all match the rubric, so they were left untouched.
Changed: Wrote the review as a separate file instead of editing AGENTS.md, which is Quang Vinh's deliverable. In that file, replaced the "Example Stack / Microservices / 3-tier / ???" placeholder with a concrete stack, and chose JavaScript + checkJs over TypeScript because package.json, tsconfig.json and the test glob are already wired for it.
Rejected: Rejected rewriting AGENTS.md directly. Rejected treating the 0-byte ci.yml as a gate: an empty workflow always passes, the exact case rubric 7 warns about. Rejected Redis, Prisma, Jest and Judge0 — reasons in the stack table.

## 2026-10-30 — Thiết lập CI chặn merge

Tool: GitHub Copilot
Asked for: Thiết lập workflow CI cho pull request, chuẩn bị nhánh thử lint/format đỏ và chuyển các lệnh hướng dẫn từ pnpm sang npm.
Kept: Dùng `npm run check` làm lệnh kiểm tra duy nhất trong workflow theo hướng dẫn tại `AGENTS.md`.
Changed: Đổi các lệnh trong `AGENTS.md` và `README.md` sang npm; thêm workflow `.github/workflows/ci.yml`; tạo nhánh `gate/ci-test` và thêm đoạn mã cố ý vi phạm lint/format vào `src/app.js`.
Rejected: Không thêm `package.json`, script kiểm tra hay cấu hình lint/format vì nằm ngoài phạm vi bước được yêu cầu. `npm run check` hiện không chạy được do repository chưa có `package.json`; chưa có PR hoặc ảnh CI vì chưa commit/push.

## 2026-29-10 - Adjust the AGENTS.md (PA#2, Bình Dương)

Tool: Gemini 4 Argon - Medium
Asked for: Adjusting the content of the AGENTS.md which is generated before (in session 3, including 4 parts: Stack, Commands, Conventions, và Never)
Kept: Kept all the content, excluding the "stack" which is need to be further researched and disscused with team
Changed: Adjust the "stack" to "example stack"
Rejected: Didn't reject any content

## 2026-29-10 - Tạo file quản lý công việc (PA#2, Bình Dương)

Tool: Gemini 3.1 Pro - Medium
Asked for: Based on the Rubric and Requirement file, create a checklist.md includes all the tasks which are needed to completed for PA#2
Kept: Keeping the content of checklist which is generated
Changed: adjust some task status from "not done" ([ ]) to "done ([x])
Rejected: Didn't reject any content

## 2026-29-10 - Tạo cấu trúc file (PA#2, Bình Dương)

Tool: MAI Code 1.1 FLASH (Auto copilot)
Asked for: Setting up the file structure for the repository (includes AI's rules files, /src, /docs, /tests, ...)
Kept: Use the structure which given by AI
Changed: add some rules file such as: "AGENTS.md", "CLAUDE.md", ".github/copilot-instructions.md"
Rejected: Didn't reject any content
