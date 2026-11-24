# Labs and submission status

Revision 1. Source of truth for `POST /labs`, the lab view of `GET /labs/{labId}` and `GET /submissions/{id}`. Errors are RFC 9457 problem details; a slug used here and in another contract keeps its status. Class access follows `auth-and-lab-access.md`.

## 1. POST /labs

A TA creates a lab in a class they teach; an admin can create one in any existing class. No other route creates a lab.

Body (no other field):

| Field         | Type   | Rule                                                                                           |
| ------------- | ------ | ---------------------------------------------------------------------------------------------- |
| `classId`     | string | An existing class the caller may manage                                                        |
| `title`       | string | 1 to 200 characters                                                                            |
| `statement`   | string | 1 to 20000 characters                                                                          |
| `tests`       | array  | 1 to 200 items `{ input: string, expectedOutput: string }`                                     |
| `constraints` | array  | 0 to 20 items `{ text: string, deduction: number }`, 1 ≤ text ≤ 500 chars, 0 ≤ deduction ≤ 100 |
| `deadline`    | string | ISO 8601 date-time with an offset                                                              |

- 201: the lab as staff see it (section 2), with `Location: /labs/{id}`. The server assigns `id` and gives the constraints the ids `c1`, `c2`, … in order.
- The deduction is a number the TA types. A model never sets it.

| Status | Slug               | When                                                                                                     |
| ------ | ------------------ | -------------------------------------------------------------------------------------------------------- |
| 400    | `validation-error` | Malformed JSON, a missing or wrong field, an unknown field; `errors[]` lists the paths.                  |
| 401    | `unauthenticated`  | No valid bearer token.                                                                                   |
| 403    | `staff-only`       | The caller is a student.                                                                                 |
| 404    | `class-not-found`  | The class does not exist, or the TA does not teach it (the same response, so a TA cannot probe classes). |

## 2. GET /labs/{labId}

Who may see a lab is in `auth-and-lab-access.md`. What they see depends on the role:

- Staff (`ta`, `admin`): `id`, `classId`, `title`, `statement`, `tests`, `constraints` (`id`, `text`, `deduction`), `deadline`.
- Student: the same without `tests`. The expected outputs stay hidden.

## 3. GET /submissions/{id}

The `Location` of `POST /labs/{labId}/submissions` points here.

- 200: `{ id, labId, studentId, language, status, createdAt }`. `status` is `queued`, `compiling`, `running`, `judged` or `failed`. The body never contains the source, a verdict or a deduction: verdicts live only in the TA's review queue.
- Who can read it: the student who made it, a TA of the lab's class, an admin.

| Status | Slug                   | When                                                          |
| ------ | ---------------------- | ------------------------------------------------------------- |
| 401    | `unauthenticated`      | No valid bearer token.                                        |
| 404    | `submission-not-found` | The submission does not exist, or the caller may not read it. |
