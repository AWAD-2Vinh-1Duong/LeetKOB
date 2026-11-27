# PA#4 — Eval, Guardrails, Human Gate and Red-Team

- **Team:** [Team Name]
- **Members:** `[Student ID 1]` — [Full Name 1] · `[Student ID 2]` — [Full Name 2] · `[Student ID 3]` — [Full Name 3]
- **Repository:** [Public GitHub Repository URL]
- **Submitted Tag:** `pa4`
- **Public Deployment URL (kept running from PA#3):** [https://your-deployment-domain]

---

## 1. Eval Gate in CI

- **CI Run for `pa4` tag:** [Link to GitHub Actions run on tag `pa4`]
- **Workflow & Branch Protection:** [Path to `.github/workflows/ci.yml` and job name, e.g., `eval-gate`, configured as a required check on `main`]
- **Datasets Evaluated in CI:**
  - Published dev set (`[path/to/dev-set]`): byte-for-byte identical to the lecturer's release.
  - Custom eval cases (`[path/to/custom-cases]`): `[N >= 10]` cases covering `trap`, `injection`, and `disguised` tags.
- **Blocked Pull Request & Fixing Commit:**
  - **Blocked PR:** [Link to PR where the eval gate went red and blocked merge] — [Brief note on what failed: wrongful deduction / recall < 90%]
  - **Fixing Commit:** `[commit hash]` ([Link to commit]) — [Brief note on how the checker/prompt was fixed without altering data or labels]
- **Handling Pull Requests from Forks:**
  - [Explain how `.github/workflows/ci.yml` handles PRs from forks where repository secrets are unavailable — e.g., running offline `MODEL_OFF=1` and unit/guardrail tests on fork PRs without leaking secrets, while running the live-model `eval-gate` on internal branch PRs or maintainer-triggered workflows.]
- **Cost of One CI Run:**
  - **Model:** `[Model ID / Name]`
  - **Token usage per CI run:** `[Input tokens]` input + `[Output tokens]` output tokens across `[Total pairs/calls]` calls
  - **Estimated / Actual Cost per CI run:** `$[X.XXXX] USD` (`[Show exact arithmetic based on provider pricing]`)

---

## 2. Three Repeated Dev-Set Runs (Same Commit)

- **Tested Commit:** `[commit hash]`
- **Stability Summary:**
  - **Pairs that changed verdict across runs:** `[X]` out of `[Total pairs]` pairs (`[List pair IDs if any changed]`)
  - **Recall range:** lowest `[Min Recall]%` — highest `[Max Recall]%`
  - **Unsure rate range:** lowest `[Min Unsure]%` — highest `[Max Unsure]%`

| Run       | CI / Run Reference  | Wrongful Deductions | Recall  | Unsure Rate |
| :-------- | :------------------ | :-----------------: | :-----: | :---------: |
| **Run 1** | [Link or timestamp] |         [0]         | [XX.X%] |   [X.X%]    |
| **Run 2** | [Link or timestamp] |         [0]         | [XX.X%] |   [X.X%]    |
| **Run 3** | [Link or timestamp] |         [0]         | [XX.X%] |   [X.X%]    |

---

## 3. Held-Out Run Configuration

- **Model Host to Allow Through Proxy:** `[api.example.com]` _(exact hostname/domain the checker container connects to during the lecturer's held-out run)_
- **Environment File:** `marking.env` (attached separately on Classroom beside the `.zip`, never committed to Git; defines `[LLM_BASE_URL]`, `[LLM_MODEL]`, `[LLM_API_KEY]`).
- **Build & Run Commands:**
  ```bash
  docker build -f [Dockerfile.checker] -t [image-name] .
  docker run --rm --env-file marking.env -v "/path/to/held-out:/data:ro" [image-name] --data /data > predictions.jsonl
  ```

---

## 4. Guardrails & Human Gate Implementation

| Mechanism                           |    Rule    | Implementation File | Fake-Model / API Test | Commit          |
| :---------------------------------- | :--------: | :------------------ | :-------------------- | :-------------- |
| **Schema validation**               |    `G1`    | `[src/...]`         | `[tests/...]`         | `[commit hash]` |
| **Evidence exact line match**       |    `G2`    | `[src/...]`         | `[tests/...]`         | `[commit hash]` |
| **Timeout fallback**                |    `G3`    | `[src/...]`         | `[tests/...]`         | `[commit hash]` |
| **Cost cap per lab**                |    `G4`    | `[src/...]`         | `[tests/...]`         | `[commit hash]` |
| **No deduction from model**         |    `G5`    | `[src/...]`         | `[tests/...]`         | `[commit hash]` |
| **Random 10% `pass` sampling**      |    `H1`    | `[src/...]`         | `[tests/...]`         | `[commit hash]` |
| **Publish API gate (pending/role)** | `H2`, `H3` | `[src/...]`         | `[tests/...]`         | `[commit hash]` |

---

## 5. Where we stop it

1. **Who pays when the checker is wrong?**
   - [Quantify using your lab numbers: e.g., in a lab of 80 students with a `[X]`-point constraint deduction, a false positive (`wrongful deduction`) unfairly penalizes compliant students, potentially causing course failure/scholarship loss and triggering up to `[N]` manual appeals. Conversely, a false negative lets a rule-breaking submission pass without penalty, undermining grading fairness.]
2. **How do you know it is wrong?**
   - [Explain your detection layers with metrics: (a) Pre-merge CI `eval-gate` blocks any change causing `> 0` wrongful deductions or `< 90%` recall; (b) Runtime guardrails `G1`–`G4` automatically convert malformed JSON, hallucinated/misaligned evidence lines, timeouts, or over-budget calls into `unsure` with explicit failure reasons; (c) Server-side random 10% sampling (`Math.ceil(0.1 * passCount)`) surfaces potential false negatives in the review queue; (d) Post-publish student appeals catch any remaining errors.]
3. **Where do you stop it?**
   - [Trace the pipeline gates: deterministic AST/syntax hard rules decide ban-lists first without LLM calls $\rightarrow$ guardrails sanitize/verify LLM verdicts and strip any model-suggested deductions $\rightarrow$ the human gate blocks `POST /labs/:labId/publish` at the API layer (`4xx` RFC 9457) until the TA has reviewed every `violation`, `unsure`, and sampled `pass` in the queue.]
4. **Why the human gate sits on `Publish` and not on every verdict (including the cost of unsampled passes):**
   - [Explain the engineering trade-off with your numbers: `Publish` is the irreversible state transition that exposes deductions to students. Placing the gate on `Publish` batches review work and guarantees no unreviewed deduction ever leaks, while avoiding blocking the async worker pipeline. For a typical lab of `[80]` submissions where `[~70]` are `pass`, sampling 10% sends `[7]` passes to the queue and leaves `[63]` unsampled passes (`90%`). Reviewing all `[63]` unsampled passes at `[2–3]` minutes per submission would cost the TA `[126–189]` minutes (`~2–3 hours`) of manual labor per lab—defeating the purpose of automation—whereas the 10% random audit + post-publish appeal mechanism bounds the residual risk at near-zero human overhead.]

---

## 6. Red-Team Report

- **Assigned Target Team:** `[Target Student IDs]`
- **Target Deployment URL:** `[https://target-deployment-url]`
- **Full Report Path:** [`docs/red-team/[target-student-ids].md`](docs/red-team/[target-student-ids].md)
- **Summary:** `[Total attacks >= 8]` attacks executed across `[Total categories >= 5]` categories (`[X]` held, `[Y]` broke, including `[Z]` vulnerability/vulnerabilities discovered via static inspection of the target's public repository).
