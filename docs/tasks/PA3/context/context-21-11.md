1. Change and update name of task and submission format - 19:23 - Binh Duong

- Refactor all the files
- in folder `LeetKOB/docs/tasks`, i created `PA-template` subfolder
  - Which is storing folder:
  * `context`: The context folder for each PA. When each member does their part, he/she just updating/creating `context-dd-mm.md`file inside this folder.
  * `task`: This folder includes all the task files for the PA.
  * `submission`: This folder includes all the content, document files, source code files for turn in in each PA (PA2 -> PA6)

2. Adding updated rule for `AGENTS.md` to update changes in each task, commit, ... - **19:31 - Binh Duong**

3. Update repository structure in `README.md` to reflect new folder layout - 19:55 - Assistant & Binh Duong

- Updated tree structure in `README.md` matching current files and `docs/tasks/` organization (`PA-template`, `PA2`, `PA3`).
- Updated relative asset link for dashboard screenshot to `docs/tasks/PA2/submission/assets/provider-dashboard.png`.
- Updated Section 4 documentation structure to describe `docs/tasks/` structure and moved submission files.
- Add `LeetKOB/docs/tasks/PA3/task/checklist.md` for PA3
- Create submission files (These files will be coppied into `LeetKOB/docs/tasks/PA3/submission`) before submitting
  - LeetKOB/PA3-SELF_ASSESSMENT_REPORT.md
  - LeetKOB/PA3.md
- Coppying the - LeetKOB/PA2-SELF_ASSESSMENT_REPORT.md and LeetKOB/PA2.md located in root folder for submission (these files will be deleted after PA#2 is marked)

4. Set up PA#3 submission workspace & verification checklist - **20:27 - Assistant & Binh Duong**

- Created `docs/tasks/PA3/submission/PA3.md` draft template with all 5 mandatory rubric sections (Public deployment & 5 test accounts, CI run on tag `pa3`, CLI checker commands with `MODEL_OFF=1`, committed dev-set run paths & cost arithmetic, E2E video link & 6-step checklist).
- Created `docs/tasks/PA3/submission/SELF_ASSESSMENT_REPORT.md` with 8 rubric criteria (100 pts), claim/evidence placeholders, and honesty adjustment rules.
- Created `docs/tasks/PA3/submission/dev-run/.gitkeep` for real-model dev-set run artifacts.
- Created `docs/tasks/PA3/submission/submission-note.txt` covering root sync rules, syllabus zero-tolerance guardrails, SHA-256 checks, 9 sandbox baselines, and turn-in procedure.
- Updated `.prettierignore` to ignore raw eval outputs in `dev-run/**` and plain-text submission notes.

5. Complete Task T02 (Update AGENTS.md, .env.example & package.json scripts) - **20:53 - Assistant & Binh Duong**

- Updated `AGENTS.md`: transitioned Stack and Commands to active PA#3 status, documented `npm run dev` and `npm run db:migrate`, and augmented `Never` section with Catching your assistant rules (no docker socket/privileged/secrets in sandbox, memory read-back, immutable dev set, no hardcoding dev problem IDs, zero-tolerance syllabus review gate).
- Updated `.env.example`: added `MODEL_OFF=` for checker switch and verified all variables remain blank.
- Updated `package.json`: added `"dev": "node --watch src/app.js"` and `"db:migrate": "node-pg-migrate up"`.
- Marked `T02` complete in `docs/tasks/PA3/task/checklist.md`.

6. Fix Prettier formatting errors across all PA#3 documents - 21:13 - Assistant & Binh Duong

- Added course rubric materials to `.prettierignore` (`docs/tasks/PA3/PA#3 rubric — Prototype with the LLM feature running.md`).
- Formatted all 11 warned markdown and task files using `npm run format`.
- Verified `npm run check` passes 100% (`lint`, `format:check`, `typecheck`, 32 contract tests).
