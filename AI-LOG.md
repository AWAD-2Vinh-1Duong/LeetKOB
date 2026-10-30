# AI Log

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

## 2026-29-10 - Tạo cấu trúc file (PA#2, Bình Dương)

Tool: MAI Code 1.1 FLASH (Auto copilot)
Asked for: Setting up the file structure for the repository (includes AI's rules files, /src, /docs, /tests, ...)
Kept: Use the structure which given by AI
Changed: add some rules file such as: "AGENTS.md", "CLAUDE.md", ".github/copilot-instructions.md"
Rejected: Didn't reject any content

## 2026-29-10 - Tạo file quản lý công việc (PA#2, Bình Dương)

Tool: Gemini 3.1 Pro - Medium
Asked for: Based on the Rubric and Requirement file, create a checklist.md includes all the tasks which are needed to completed for PA#2
Kept: Keeping the content of checklist which is generated
Changed: adjust some task status from "not done" ([ ]) to "done ([x])
Rejected: Didn't reject any content

## 2026-29-10 - Adjust the AGENTS.md (PA#2, Bình Dương)

Tool: Gemini 4 Argon - Medium
Asked for: Adjusting the content of the AGENTS.md which is generated before (in session 3, including 4 parts: Stack, Commands, Conventions, và Never)
Kept: Kept all the content, excluding the "stack" which is need to be further researched and disscused with team
Changed: Adjust the "stack" to "example stack"
Rejected: Didn't reject any content

## 2026-10-30 — Thiết lập CI chặn merge

Tool: GitHub Copilot
Asked for: Thiết lập workflow CI cho pull request, chuẩn bị nhánh thử lint/format đỏ và chuyển các lệnh hướng dẫn từ pnpm sang npm.
Kept: Dùng `npm run check` làm lệnh kiểm tra duy nhất trong workflow theo hướng dẫn tại `AGENTS.md`.
Changed: Đổi các lệnh trong `AGENTS.md` và `README.md` sang npm; thêm workflow `.github/workflows/ci.yml`; tạo nhánh `gate/ci-test` và thêm đoạn mã cố ý vi phạm lint/format vào `src/app.js`.
Rejected: Không thêm `package.json`, script kiểm tra hay cấu hình lint/format vì nằm ngoài phạm vi bước được yêu cầu. `npm run check` hiện không chạy được do repository chưa có `package.json`; chưa có PR hoặc ảnh CI vì chưa commit/push.

