# Review queue

Revision 1. Source of truth for the content of `GET /labs/{labId}/review-queue` and for `PUT /labs/{labId}/review-queue/{verdictId}`. Who may open the queue, and the order of the checks, is in `auth-and-lab-access.md` section 4. Errors are RFC 9457 problem details with `type` = `https://leettkob.dev/problems/<slug>`; a slug used in another contract keeps its status there.

A verdict is one (submission, constraint) pair. The hard rules or the model write a **proposal** (`pass`, `violation` or `unsure`). Only a TA's **decision** (`pass` or `violation`) can become a deduction, and nothing in this build turns a decision into a published mark: there is no Publish action yet. Students never see a proposal or a decision before publishing (product owners' FAQ-08).

## 1. GET /labs/{labId}/review-queue

200 for an `admin` or a `ta` of the lab's class:

```json
{
  "items": [
    {
      "id": "string",
      "submissionId": "string",
      "studentId": "string",
      "source": "string",
      "constraintId": "c1",
      "constraint": "string",
      "deduction": 3,
      "proposal": {
        "verdict": "violation",
        "evidence": [{ "line": 4, "text": "std::sort(a, a + n);" }]
      },
      "decision": null
    }
  ]
}
```

- One item per stored verdict of the lab's submissions, ordered by the submission's creation time, then by `constraintId`. A lab with no judged submission gives `{ "items": [] }`.
- `constraint` and `deduction` come from the lab's constraint: the deduction is the number the TA set on the lab, never one from a model (FAQ-11).
- `source` is the whole submitted code, so the TA can check the evidence lines (FAQ-09).
- `proposal` is what the hard rules or the model said. A TA decision never changes it.
- `decision` is `null` until a TA decides, then `{ "verdict", "evidence", "deduction", "reviewedBy", "reviewedAt" }` (section 2).

## 2. PUT /labs/{labId}/review-queue/{verdictId}

A TA of the lab's class, or an admin, records a decision on one verdict. Sending it again replaces the previous decision, so the request is safe to repeat.

Body (no other field):

| Field           | Type      | Rule                                                                                                 |
| --------------- | --------- | ---------------------------------------------------------------------------------------------------- |
| `verdict`       | string    | `pass` or `violation`. `unsure` is not a decision (FAQ-09).                                          |
| `evidenceLines` | integer[] | 1-based line numbers of the source. At least one for `violation`; must be absent or empty for `pass` |

- 200: the item as in section 1, with `decision` = `{ verdict, evidence, deduction, reviewedBy, reviewedAt }`.
  - `evidence` is `[{ line, text }]`, the text taken from the submitted source, in the order sent, without repeats.
  - `deduction` is the constraint's deduction for `violation`, `0` for `pass`.
  - `reviewedBy` is the caller's user id, `reviewedAt` an ISO 8601 date-time.
- The checks run in this order, the first that fails answers:

| Status | Slug                     | When                                                                                                                                 |
| ------ | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| 401    | `unauthenticated`        | No valid bearer token.                                                                                                               |
| 404    | `lab-not-found`          | The lab does not exist or the caller cannot see it.                                                                                  |
| 403    | `staff-only`             | The caller can see the lab but is a student.                                                                                         |
| 400    | `validation-error`       | Malformed JSON, a missing or wrong field, an unknown field, `violation` with no line, `pass` with lines; `errors[]` lists the paths. |
| 404    | `verdict-not-found`      | No verdict with this id belongs to this lab.                                                                                         |
| 422    | `evidence-not-in-source` | An evidence line is outside the source or is blank.                                                                                  |
