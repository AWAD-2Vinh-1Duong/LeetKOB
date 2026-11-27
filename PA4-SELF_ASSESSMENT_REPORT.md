# Self-assessment — PA#4 (Eval, guardrails, human gate and red-team)

Submitted by: [Student ID] — [Full name]  
Group work:

- [Student ID 1] — [Full name 1]: [Summary of parts owned]
- [Student ID 2] — [Full name 2]: [Summary of parts owned]
- [Student ID 3] — [Full name 3]: [Summary of parts owned]  
  Total I claim: [Total] / 100

Score yourself against the rubric for PA#4, criterion by criterion.

| Criterion                          |     Max |     I claim | Evidence                                                                                                                   |
| :--------------------------------- | ------: | ----------: | :------------------------------------------------------------------------------------------------------------------------- |
| 1. The eval gates CI               |      20 |   [Claimed] | [CI workflow file, required check screenshot/link, blocked PR link, fixing commit hash, PA4.md repeated runs & CI cost]    |
| 2. The held-out run                |      20 |   [Claimed] | [Claimed based on dev-set and custom-cases runs: 0 wrongful deductions, recall X%, unsure Y%; Dockerfile.checker & PA4.md] |
| 3. The guardrails of section 3     |      20 |   [Claimed] | [Individual commits and fake-model test files for all 5 guardrails: schema, evidence, timeout, cost cap, no deduction]     |
| 4. The human gate                  |      15 |   [Claimed] | [Queue sampling logic & fixed-seed test, Publish API authorization/pending-review tests, PA4.md "Where we stop it"]        |
| 5. Red-team report on another team |      20 |   [Claimed] | [Path to docs/red-team/<target-ids>.md covering >= 8 attacks across >= 5 categories]                                       |
| 6. AI-LOG.md                       |       5 |   [Claimed] | [AI-LOG.md PA#4 entries with tools used and real Changed/Rejected cases]                                                   |
| **Total**                          | **100** | **[Total]** |                                                                                                                            |

## What we did not manage

[Briefly describe anything incomplete, any edge case not covered, or any requirement you could not fully meet.]

## What we would do differently

[Briefly describe what you would change in your engineering, prompt design, testing, or workflow next time.]

## Rules

- **Evidence must point to something:** name a file, section, commit, test, PR, or CI run. Unsupported claims count as claimed and not done for the honesty comparison.
- For criterion 2 (The held-out run), claim what your dev-set and custom-cases runs suggest, and state that explicitly.
- The section _What we did not manage_ is scored as honesty, not as failure. Be frank about incomplete work.
- The total in this table must match the total in the submission file name (`<ID1>-<ID2>-<ID3>_<Total>.zip`). If they disagree, the table total is used.
- Your self-score does not set your mark. The honesty adjustment compares your total with the mark you earn, on the same 100-point scale:

| Gap                            |                                       Adjustment |
| :----------------------------- | -----------------------------------------------: |
| Within ±10                     |                                             None |
| +11 to +20                     |                                               −3 |
| +21 to +30                     |                                               −6 |
| More than +30                  |                                              −10 |
| −21 or worse                   | −3; read the rubric before scoring yourself down |
| No `SELF_ASSESSMENT_REPORT.md` |              −10; the file-name total is ignored |

The adjustment never takes a submission below 0. Scoring yourself honestly low costs nothing within ±10; claiming marks you did not earn may cost more than those marks are worth.
