
# PA#3 Self-Assessment Report — LeeTKOB

- **Course:** CSC13114 — Class CQ2023/3
- **Milestone:** PA#3 — Prototype with the LLM feature running
- **Team Members:**
  - `23120190` — Quang Vinh
  - `23120202` — Thế Vinh
  - `23120242` — Nguyễn Văn Bình Dương
- **Submitted Tag:** `pa3`
- **Self-Assessed Total:** `<XX>` / 100

## 1. Rubric Self-Assessment

| # | Criterion | Max Points | Claimed Points | Evidence (Files, Commits, PRs, CI Runs) |
| :- | :--- | :-: | :-: | :--- |
| 1 | The flow, end to end, on your deployment | 15 | `<15>` | Public deployment in `PA3.md`, recording `<link>`, auth/RBAC tests in `<tests/...>` (`<commit-hash>`) |
| 2 | Queue and sandbox | 20 | `<20>` | Worker `FOR UPDATE SKIP LOCKED` in `<src/...>`, 9 attack `.cpp` tests in `<tests/sandbox/...>`, CI run `<link>` |
| 3 | Hard rules first | 15 | `<15>` | Syntax-aware checker in `<src/...>`, trap tests in `<tests/...>`, `MODEL_OFF=1` dev run (`0` wrongful deductions) |
| 4 | The model judges the semantic constraints | 20 | `<20>` | `ConstraintJudge` adapter in `<src/...>`, committed dev-set run in `<docs/tasks/PA3/submission/dev-run/>`, cost arithmetic in `README.md` & `AI-LOG.md` |
| 5 | First limits, and the review queue | 10 | `<10>` | `zod` schema & timeout guardrails in `<src/...>`, fake-model tests in `<tests/...>`, review queue & FAQ `<#id>` citation in `<src/...>` |
| 6 | The checker command and a first eval | 10 | `<10>` | CLI `<src/cli/...>`, `Dockerfile.checker`, SHA-256 verified `dev set`, custom cases in `<eval/custom-cases/>` |
| 7 | Tests first, one part per commit | 5 | `<5>` | Git commit history on tag `pa3` (`git log --stat pa3`): test commits precede implementation commits per module |
| 8 | AI-LOG.md | 5 | `<5>` | `AI-LOG.md` (top PA#3 section with real `Changed`/`Rejected` entries and cost calculation) |
| | **Total** | **100** | **`<XX>`** | |

## 2. What We Did Not Manage

- *(Liệt kê ngắn gọn, trung thực những phần chưa hoàn thiện hoặc để dành sang PA#4 theo đúng lộ trình, ví dụ:)*
  - Guardrails G2 (exact evidence line-number matching against original source), G4 (runtime per-lab cost cap enforcement), and random 10% sampling of `pass` verdicts in the review queue are scheduled for PA#4 as specified in the project roadmap.
  - Real-time status updates without page reload (SSE/WebSocket) and post-publish student appeals are deferred to PA#5.