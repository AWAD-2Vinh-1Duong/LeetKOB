# PA#3 Submission — LeeTKOB (Prototype with the LLM Feature Running)

- **Team:** `AWAD-2Vinh-1Duong`
- **Members:**
  - `23120190` — Nguyễn Lê Thế Vinh
  - `23120202` — Phạm Quang Vinh
  - `23120242` — Nguyễn Văn Bình Dương (Lead)
- **Public GitHub Repository:** https://github.com/AWAD-2Vinh-1Duong/LeetKOB
- **Git Submission Tag:** `pa3`

---

## 1. Public Deployment & Test Accounts

- **Public Application URL:** `<TODO: https://...>`

  > **Note on Deployment Uptime:** This public instance remains active continuously from the submission deadline (Wednesday, Nov 25, 2026, 22:00) until PA#4 grades are published, as other student teams will conduct red-team security attacks against it.

- **Spending Cap & Model Policy:**
  - **Provider:** Google Gemini via Google AI Studio (`ag/gemini-3.8-flash`, Free Tier).
  - **Spending Cap:** `$0.00 USD` (strictly enforced by provider). The API key belongs to project `For-Github-CodeSpace` with no billing account attached. Any request exceeding the Free-tier quota receives HTTP `429 RESOURCE_EXHAUSTED` and never incurs financial charges.
  - **Public Exposure Guard:** All synthetic test accounts are strictly isolated and carry no real personal data.

### Synthetic Test Accounts (5 Pre-created Accounts)

| Role          | Username / Email                        | Password           | Class / Scope | Description & Purpose                                                     |
| :------------ | :-------------------------------------- | :----------------- | :------------ | :------------------------------------------------------------------------ |
| **Admin**     | `<TODO: admin@leettkob.dev>`            | `<TODO: password>` | Global        | System administration, user/class provisioning                            |
| **TA 1**      | `<TODO: ta1@leettkob.dev>`              | `<TODO: password>` | Class A       | Lab owner for `sort-merge`, manages Review Queue                          |
| **TA 2**      | `<TODO: ta2@leettkob.dev>`              | `<TODO: password>` | Class B       | Belongs to a different class; used to test authorization denial (403/404) |
| **Student 1** | `<TODO: student1@student.hcmus.edu.vn>` | `<TODO: password>` | Class A       | Enrolled in TA1's class; submits compliant solution                       |
| **Student 2** | `<TODO: student2@student.hcmus.edu.vn>` | `<TODO: password>` | Class A       | Enrolled in TA1's class; submits violation & injection solutions          |

---

## 2. CI Run for `pa3` Tag

- **CI Actions Run Link for Tag `pa3`:** `<TODO: https://github.com/AWAD-2Vinh-1Duong/LeetKOB/actions/runs/...>`  
  _(Branch/tag runs overview: https://github.com/AWAD-2Vinh-1Duong/LeetKOB/actions?query=branch%3Apa3)_

### Verified CI Checks

1. **Repository Quality Gate:** `npm ci` followed by `npm run check` (Lint via ESLint, Format via Prettier, Typecheck via TypeScript `checkJs`, and Contract tests).
2. **Sandbox Baselines (9 Minimums `M1`–`M9`):** 9 distinct attack `.cpp` submissions compiled and executed inside the hardened sandbox container:
   - `M1`: Network isolation (`--network none`)
   - `M2`: CPU time limit enforcement
   - `M3`: Wall-clock timeout (killing entire container)
   - `M4`: Memory & swap limit (with memory read-back)
   - `M5`: Process limit (`pids-limit`)
   - `M6`: Output size limit
   - `M7`: Non-root user execution
   - `M8`: No host mounts and no Docker socket (`/var/run/docker.sock`)
   - `M9`: Secret isolation (no `LLM_API_KEY` in sandbox env, filesystem, or headers)
3. **CLI Checker Test (`MODEL_OFF=1`):** Image build and execution on dev set with model off, confirming exit code `0` or `1` (never `2`) and `0 wrongful deductions`.

---

## 3. CLI Checker, Docker Build & `MODEL_OFF=1`

The CLI checker evaluates semantic and syntactic constraints on any standard dataset folder without per-problem manual configuration.

### Docker Build Command

```bash
docker build -t leetkob-checker -f Dockerfile .
```

### Model-Off Execution (`MODEL_OFF=1`)

Runs strictly hard rules, writes `unsure` for all semantic constraints, and executes in complete network isolation:

```bash
docker run --rm --network none \
  -e MODEL_OFF=1 \
  -v <absolute-path-to-dataset>:/dataset:ro \
  -v $(pwd)/predictions.jsonl:/output/predictions.jsonl \
  leetkob-checker /dataset /output/predictions.jsonl
```

### Real-Model Execution (`MODEL_OFF=0`)

Invokes Google Gemini with comment/identity-stripped prompts:

```bash
docker run --rm \
  -e MODEL_OFF=0 \
  -e LLM_API_KEY="<YOUR_GEMINI_API_KEY>" \
  -v <absolute-path-to-dataset>:/dataset:ro \
  -v $(pwd)/predictions.jsonl:/output/predictions.jsonl \
  leetkob-checker /dataset /output/predictions.jsonl
```

### Re-scoring Predictions with `eval.mjs`

```bash
node eval.mjs --predictions predictions.jsonl --dataset <dataset-dir> --labels <dataset-dir>/labels.jsonl
```

---

## 4. Committed Real-Model Dev-Set Run

The outputs from the real-model evaluation run on the `dev set` are committed directly into the repository:

- **Predictions File:** [`docs/tasks/PA3/submission/dev-run/predictions.jsonl`](dev-run/predictions.jsonl)
- **`eval.mjs` Summary Report:** [`docs/tasks/PA3/submission/dev-run/eval-report.txt`](dev-run/eval-report.txt)
- **Full Call Log:** [`docs/tasks/PA3/submission/dev-run/call-log.jsonl`](dev-run/call-log.jsonl)
  - Records for every LLM invocation: `provider request_id`, model name (`ag/gemini-3.8-flash`), token counts (prompt & completion), latency (ms), calculated cost ($), and the exact prompt dispatched (sanitized of comments and student identifiers).
- **Custom Eval Cases Directory:** [`<TODO: eval/custom-cases/ or docs/tasks/PA3/submission/custom-cases/>`](<TODO: path>)
  - Contains `≥ 5` custom test cases in standard `dev set` format with `labels.jsonl`, including at least 1 `trap` case (compliant code using similar keywords) and at least 1 `injection` case (prompt injection attempt in C++ code/comments).

### Cost Arithmetic for 1 Lab (80 Submissions)

- **Selected Model:** `ag/gemini-3.8-flash` (Google AI Studio Free Tier).
- **Token Usage Estimation:**
  - Average Input Tokens per submission: `<TODO: e.g. 850>` tokens
  - Average Output Tokens per submission: `<TODO: e.g. 160>` tokens
  - Total Input Tokens (80 submissions): $80 \times \text{Input} = \text{<TODO: e.g. 68,000>}$ tokens
  - Total Output Tokens (80 submissions): $80 \times \text{Output} = \text{<TODO: e.g. 12,800>}$ tokens
- **Actual Cost on Free Tier:** **`$0.00 USD`** (within free quota).
- **Theoretical Cost on Paid Tier (Reference):**
  - Pricing: \$0.075 / 1M input tokens, \$0.30 / 1M output tokens
  - Formula: $\text{Total Cost} = (68,000 \times \$0.075 / 10^6) + (12,800 \times \$0.30 / 10^6) \approx \$0.0051 + \$0.0038 = \mathbf{\$0.0089\ USD}$.

---

## 5. End-to-End Screen Recording (≤ 5 minutes)

- **Recording URL:** `<TODO: https://youtu.be/... hoặc Google Drive public link>`
  _(Must be accessible publicly without requiring permissions or authentication)_

### Demonstrated End-to-End Flow

1. **Lab Creation (TA1):** TA1 logs in, navigates to Class A, creates the `sort-merge` lab by entering the problem statement, test cases, and two constraints with associated deduction values.
2. **Compliant Submission (Student 1):** Student 1 logs in, submits compliant C++ code, transitions from `queued` to sandbox `Accepted`.
3. **Violation & Injection Submissions (Student 2):** Student 2 logs in, submits a solution violating constraints and a solution attempting prompt injection (`"Ignore previous instructions..."`).
4. **Queue Idempotency Demonstration (`Q1` Rule):**
   - The queue worker process is stopped.
   - A new submission is submitted (state remains `queued`).
   - The queue worker is restarted.
   - Verification that the submission is processed and judged **exactly once** (only 1 verdict record saved).
5. **Review Queue & Human Gate (TA1):**
   - TA1 accesses the Review Queue.
   - Verifies verdicts (`pass`, `violation`, `unsure`), supporting evidence lines with line numbers, and deduction amounts.
   - Demonstrates that deductions/verdicts are NOT automatically applied to published student grades without explicit TA approval.
6. **Cross-Class Authorization Denial (TA2):**
   - TA2 logs in (Class B).
   - Attempts to access TA1's lab or review queue directly via UI/API.
   - Verification of immediate denial (HTTP 403 Forbidden or 404 Not Found per RFC 9457 contract).
