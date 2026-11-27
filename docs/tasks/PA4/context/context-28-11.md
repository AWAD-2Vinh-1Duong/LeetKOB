Template files

1. <name of the action> -- <hh-mm> -- <Name>
   Example:
1. Set up prototype for PA4-- 00:09 - Binh Duong

- Add some template files for PA4
  - Self assessment
  - PA4.md
  - checklist.md for PA#4 in LeetKOB/docs/tasks/PA4/task/checklist.md

2. Complete task T02: Update `AGENTS.md`, `.env.example`, `.gitignore` & `CODEOWNERS` for PA4 -- 00:21 -- Agent / Binh Duong

- `AGENTS.md`:
  - Updated `## 4. Never` to keep real-model calls banned in unit/contract tests and the `quality` CI job while allowing them in the dedicated CI `eval-gate` job via repository secrets (never exposed to fork PRs).
  - Added PA#4 rules: never edit labels, `.cpp` files, or tags in `eval/custom-cases/` or `eval/dev-set/` to make a red eval gate pass; never commit `marking.env` or pack it in the submission `.zip`; never write a guardrail test that passes when guardrail code is removed.
  - Updated `## 5. Permissions` (Tier 3) to prohibit reading, printing, editing, or committing `marking.env` alongside `.env`.
- `.env.example`: Verified `LLM_COST_CAP_PER_LAB_USD=` is already present with an empty value in the `LLM_*` group.
- `.gitignore`: Added `marking.env` and verified with `git check-ignore -v marking.env`.
- `.github/CODEOWNERS`: Created to protect `/tests/`, `/eval/`, and `/.github/` under `@AWAD-2Vinh-1Duong`.
- Verified `npm run format` and `npm run check` (`lint`, `format:check`, `typecheck`, `test`) pass cleanly before committing.
