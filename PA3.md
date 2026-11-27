# PA#3 — Prototype with the LLM Feature Running

- **Team:** AWAD-2Vinh-1Duong
- **Members:** `23120190` — Nguyễn Lê Thế Vinh · `23120202` — Phạm Quang Vinh · `23120242` — Nguyễn Văn Bình Dương
- **Repository:** https://github.com/AWAD-2Vinh-1Duong/LeetKOB
- **Submitted Tag:** `pa3`

## 1. Public Deployment & Test Accounts

- **Public URL:** https://57.155.2.27.sslip.io _(kept running until PA#4 marks are out)_
- **API Spending Cap:** `$0 USD` (`gemini-3.5-flash` on the Google AI Studio free tier, no billing attached; the committed dev-run was measured earlier with `ag/gemini-3.8-flash` through 9router, also free)
- The backend is a REST API (no web UI): `GET /` returns `404`. Use the `curl` walk-through below.

> **Note:** All accounts below contain synthetic test data only.

| Role          | Class   | Email                           | Password            |
| :------------ | :------ | :------------------------------ | :------------------ |
| **Admin**     | All     | `admin@leettkob.dev`            | `AdminTest#2026`    |
| **TA 1**      | Class A | `ta1@leettkob.dev`              | `Ta1Test#2026`      |
| **TA 2**      | Class B | `ta2@leettkob.dev`              | `Ta2Test#2026`      |
| **Student 1** | Class A | `student1@student.hcmus.edu.vn` | `Student1Test#2026` |
| **Student 2** | Class A | `student2@student.hcmus.edu.vn` | `Student2Test#2026` |

Class ids: Class A = `class-a`, Class B = `class-b`.

### End-to-End walk-through with `curl`

```bash
export BASE_URL="https://57.155.2.27.sslip.io"
login() { curl -sS -X POST "$BASE_URL/auth/login" -H "Content-Type: application/json" \
  -d "{\"email\":\"$1\",\"password\":\"$2\"}" | node -pe "JSON.parse(require('fs').readFileSync(0,'utf8')).token"; }

# 1. TA1 logs in and creates the `sort-merge` lab in Class A (201)
TA1=$(login ta1@leettkob.dev 'Ta1Test#2026')
LAB_ID=$(curl -sS -X POST "$BASE_URL/labs" -H "Authorization: Bearer $TA1" -H "Content-Type: application/json" -d '{
  "classId": "class-a", "title": "sort-merge",
  "statement": "Read n and n integers; print them sorted ascending, separated by spaces. Implement merge sort.",
  "tests": [{ "input": "4\n4 2 3 1\n", "expectedOutput": "1 2 3 4\n" }],
  "constraints": [
    { "text": "Do not use `std::sort`", "deduction": 50 },
    { "text": "Must implement merge sort (divide, sort halves, merge), not another algorithm", "deduction": 50 }
  ],
  "deadline": "2026-12-31T23:59:59+07:00" }' | node -pe "JSON.parse(require('fs').readFileSync(0,'utf8')).id")

# 2. Student 1 submits a compliant solution; the worker judges it in the sandbox (202 queued)
S1=$(login student1@student.hcmus.edu.vn 'Student1Test#2026')
curl -i -sS -X POST "$BASE_URL/labs/$LAB_ID/submissions" -H "Authorization: Bearer $S1" \
  -H "Idempotency-Key: demo-1" -H "Content-Type: application/json" \
  -d '{"language":"cpp","source":"<your C++ source>"}'

# 3. TA1 opens the review queue of the lab (verdicts, evidence, deductions)
#    NOTE: today this endpoint returns `{"items":[]}` — see "Known gaps" below.
curl -sS "$BASE_URL/labs/$LAB_ID/review-queue" -H "Authorization: Bearer $TA1"

# 4. TA2 (Class B) asks for TA1's lab and queue: 404 problem+json (RFC 9457, slug lab-not-found)
TA2=$(login ta2@leettkob.dev 'Ta2Test#2026')
curl -i -sS "$BASE_URL/labs/$LAB_ID" -H "Authorization: Bearer $TA2"
curl -i -sS "$BASE_URL/labs/$LAB_ID/review-queue" -H "Authorization: Bearer $TA2"
```

A student who asks for the lab of another class gets the same `404`, and a student calling the review queue gets `403 staff-only`.

### What a student sees before publishing

- `<TODO: cite the Product Owners' FAQ entry (number/question) that decides what a student sees before the TA publishes>`
- In this build `GET /submissions/:id` returns only the status (`queued` → `running` → `judged`/`failed`), never a verdict, evidence, deduction or source (tested in `tests/labs/labs-api.test.js`). Nothing publishes a verdict into a mark.

## 2. CI Run for `pa3` Tag (Including Sandbox Attack Tests)

- **GitHub Actions CI Run (`pa3` tag):** `<TODO: https://github.com/AWAD-2Vinh-1Duong/LeetKOB/actions/runs/...>`
- **Jobs (`.github/workflows/ci.yml`):**
  - `quality`: `npm ci` then `npm run check` (`lint`, `format:check`, `typecheck`, all `node:test` suites, including the checker test with the model off).
  - `sandbox`: builds `Dockerfile.sandbox` and runs the 9 attack submissions `M1`–`M9` in the real container (`SANDBOX_DOCKER=1 node --test tests/sandbox/sandbox-attacks.test.js`).

## 3. CLI Checker, Docker Build & `MODEL_OFF=1`

- **Build the checker image:**
  ```bash
  docker build -f Dockerfile.checker -t leetkob-checker .
  ```
- **Run with the model off** (hard rules only, `unsure` for every semantic constraint, no network):
  ```bash
  docker run --rm --network none --memory 512m --pids-limit 64 -e MODEL_OFF=1 \
    -v "$PWD/eval/dev-set:/data:ro" leetkob-checker --data /data > predictions.jsonl
  ```
- **Without Docker:**
  ```bash
  MODEL_OFF=1 node src/checker.js --data eval/dev-set --out predictions.jsonl
  ```
- **With the real model** (`MODEL_OFF` unset; needs `LLM_BASE_URL`, `LLM_MODEL`, `LLM_API_KEY`, set in the environment, never committed):
  ```bash
  node src/checker.js --data eval/dev-set --out predictions.jsonl --call-log call-log.jsonl
  ```
- **Re-score with the lecturer's `eval.mjs`:**
  ```bash
  node eval/dev-set/eval.mjs --data eval/dev-set --predictions predictions.jsonl
  ```

## 4. Committed Real-Model Dev-Set Run

- **Predictions:** [`docs/tasks/PA3/submission/dev-run/predictions.jsonl`](docs/tasks/PA3/submission/dev-run/predictions.jsonl)
- **`eval.mjs` report:** [`docs/tasks/PA3/submission/dev-run/eval-report.txt`](docs/tasks/PA3/submission/dev-run/eval-report.txt)
- **Call log:** [`docs/tasks/PA3/submission/dev-run/call-log.jsonl`](docs/tasks/PA3/submission/dev-run/call-log.jsonl): per call the request id returned by 9router (`chatcmpl-...`), the model of that run (`ag/gemini-3.8-flash`), tokens, latency, cost and the prompt sent (comments and identity removed).
- **Our own cases:** [`eval/custom-cases/`](eval/custom-cases/) (6 solutions, 12 labelled pairs, with `trap` and `injection` tags).

| Metric              | Result            | Target |
| :------------------ | :---------------- | :----- |
| Wrongful deductions | **0**             | 0      |
| Recall              | **94.6%** (35/37) | ≥ 90%  |
| Unsure rate         | **1.0%** (1/102)  | ≤ 20%  |

Not caught: `reverse-words/s05` C1 (predicted pass) and `gcd-euclid/s07` C2 (predicted unsure). Cost of one lab of 80 submissions: see the arithmetic in the [README](README.md) (≈ 199,711 input + 3,244 output tokens, `$0.00`).

## Known gaps (honest status)

- **Review queue (T16) is not finished:** `GET /labs/:labId/review-queue` checks access (TA of the class or admin, `404` for other classes, `403` for students) but returns `{"items":[]}`. Verdicts are stored in the `verdicts` table with `deduction = 0` and `is_reviewed = false`; no endpoint lists them yet and nothing turns a verdict into a published mark.
- The Product Owners' FAQ entry above is still to be cited.

## 5. End-to-End Screen Recording (≤ 5 minutes)

- **Recording URL:** `<TODO: https://youtu.be/... or Google Drive public link>`
- **Flow shown:** TA1 creates `sort-merge` → Student 1 submits a compliant solution, Student 2 a violation and an injection → stop the worker, submit, start the worker (judged once, `Q1`) → TA1 opens the review queue → TA2 is refused (`404`, RFC 9457).
