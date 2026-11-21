# Self-assessment — PA#3: Prototype with the LLM Feature Running

- **Submitted by:** Team `AWAD-2Vinh-1Duong`
- **Members:**
  - `23120190` — Nguyễn Lê Thế Vinh
  - `23120202` — Phạm Quang Vinh
  - `23120242` — Nguyễn Văn Bình Dương (Lead)
- **Total I claim:** `<TODO: total, e.g. 100>` / 100

Score yourself against the rubric for PA#3, criterion by criterion. Every claimed mark must be substantiated with explicit evidence.

| # | Criterion | Max | I claim | Evidence |
| :-: | :--- | :-: | :-: | :--- |
| 1 | **The flow, end to end, on your deployment** | 15 | `<TODO: 15>` | Public URL: `<TODO: URL>` in [PA3.md](PA3.md). Verified end-to-end: TA1 creates `sort-merge` lab with tests & 2 constraints; Student 1 submits compliant (`Accepted`); Student 2 submits violation & prompt injection; Review Queue displays verdicts, evidence code lines, and TA deductions; TA2 (Class B) is denied access (HTTP 403/404). Screen recording: `<TODO: link>` (≤ 5 mins). |
| 2 | **Queue and sandbox** | 20 | `<TODO: 20>` | 9 sandbox attack submissions (`M1`–`M9`) in repository under `<TODO: path, e.g. tests/sandbox/>` running and passing on CI tag `pa3` ([CI Run `<TODO: run ID>`](<TODO: link>)). Container compiles inside sandbox, no socket, no root, memory read-back. Queue worker idempotency (`Q1` rule): stopping worker, submitting, and restarting results in exactly one verdict set stored (demonstrated in test `<TODO: test path>` and recording). |
| 3 | **Hard rules first** | 15 | `<TODO: 15>` | Syntax-aware parser (AST via `<TODO: tree-sitter / clang>`) in `<TODO: path>`. Traps do not fire wrongful deductions (compliant traps test suite: `<TODO: test path>`). When hard rules decide constraints, LLM is not invoked (proven by call log). Dev-set model-off run scores 0 wrongful deductions. |
| 4 | **The model judges the semantic constraints** | 20 | `<TODO: 20>` | Real model calls (`gemini-3.6-flash`, Free Tier, 0 USD cap) implemented in `<TODO: path>`. Sanitizer strips all comments (`//`, `/* */`) and student identifiers before calling model (verified in unit test `<TODO: test path>`). Committed dev-set run: [`predictions.jsonl`](dev-run/predictions.jsonl), [`eval-report.txt`](dev-run/eval-report.txt), and [`call-log.jsonl`](dev-run/call-log.jsonl) containing provider request IDs, tokens, latency, cost. Cost arithmetic documented in [README.md](../../../README.md) and [AI-LOG.md](../../../AI-LOG.md). |
| 5 | **First limits, and the review queue** | 10 | `<TODO: 10>` | Schema guardrail and HTTP timeout fallback to `unsure` tested with fake model and no network in `<TODO: test path>`. Verdicts land exclusively in TA Review Queue ([`docs/contract/post-labs-submissions.md`](../../contract/post-labs-submissions.md)). No automatic deduction reaches student marks before TA confirmation. Publish action strictly blocked while unreviewed verdicts remain. Student view adheres to PO FAQ entry `<TODO: FAQ-ID>`. |
| 6 | **The checker command and a first eval** | 10 | `<TODO: 10>` | Dockerfile provided for CLI checker. Runs on dev set with `MODEL_OFF=1` in container (`--network none`, memory & process limits) ending in exit code 0 or 1 (never 2) and 0 wrongful deductions. Dev set matches official SHA-256 byte-for-byte. Custom test suite in `<TODO: path>` with `≥ 5` cases including `trap` and `injection`. |
| 7 | **Tests first, one part per commit** | 5 | `<TODO: 5>` | Git history demonstrates tests committed before or in the same commit as feature implementation. Granular commits per functional module: sandbox attacks ([commit `<TODO: hash>`](<TODO: link>)), queue idempotency ([commit `<TODO: hash>`](<TODO: link>)), hard rules ([commit `<TODO: hash>`](<TODO: link>)), model pipeline ([commit `<TODO: hash>`](<TODO: link>)), guardrails ([commit `<TODO: hash>`](<TODO: link>)). No tests loosened to turn green. |
| 8 | **AI-LOG.md** | 5 | `<TODO: 5>` | Substantive entries in [AI-LOG.md](../../../AI-LOG.md) organized chronologically (newest on top) detailing tools used, component scopes, and authentic `Changed` and `Rejected` decisions (e.g., rejecting regex hard rules in favor of AST, catching memory allocation compiler optimization). |
| | **Total** | **100** | **`<TODO: 100>`** | *(Must strictly match the number in the submission archive filename)* |

---

## What we did not manage

- `<TODO: Detail any limitations, deferred non-critical requirements, or known edge cases frankly. Example: "We did not implement automatic retry for provider rate limits; instead, we relied on worker task rescheduling.">`

---

## What we would do differently

- `<TODO: Note improvements for subsequent milestones (PA#4 to PA#6). Example: "Start creating custom eval cases earlier in the sprint to guide prompt refinement in parallel with hard rule implementation.">`

---

## Submission & Honesty Rules

- **Evidence Requirement:** Every claimed criterion must point directly to verifiable evidence (file path, commit hash, pull request, or CI run link). Claims lacking supporting evidence will be treated as claimed and not done during grading comparison.
- **Filename Agreement:** The total claimed in this report must exactly match the number in the uploaded zip filename:  
  `23120190-23120202-23120242_<Total>.zip` (e.g., `23120190-23120202-23120242_100.zip`).
- **Honesty Adjustment Scale:**
  The gap is calculated as: $\text{Gap} = \text{Claimed Total} - \text{Actual Score}$.

  | Gap Range | Score Adjustment |
  | :--- | :---: |
  | Within $\pm 10$ points | None (Normal calibration) |
  | $+11$ to $+20$ points | $-3$ points |
  | $+21$ to $+30$ points | $-6$ points |
  | More than $+30$ points | $-10$ points |
  | $-21$ or worse | $-3$ points (Read rubric before scoring yourself down) |
  | Missing `SELF_ASSESSMENT_REPORT.md` | $-10$ points (and file name total is ignored) |
