# POST /labs/{labId}/submissions

A student submits C++ source code for a lab. The submission is stored and queued for judging in the sandbox. A retried request with the same `Idempotency-Key` returns the first result and never creates a second submission.

- Contract revision: **1** (2026-11-01)
- Tests: [`tests/contract/post-labs-submissions.test.js`](../../tests/contract/post-labs-submissions.test.js)

## 1. Who may call it

| Rule           | Value                                                                                                                                                                                                                 |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authentication | `Authorization: Bearer <JWT>`, HS256, signed with the server's `JWT_SECRET`. Required claims: `sub` (user id, non-empty string), `role` (`admin`, `ta` or `student`), `exp`.                                          |
| Role           | `student` only. A valid token with role `ta` or `admin` gets `403 forbidden-role`.                                                                                                                                    |
| Ownership      | The student must be enrolled in the class that owns `labId`. A lab in a class the student is not enrolled in answers exactly like a lab that does not exist: `404 lab-not-found`, so a stranger cannot probe lab ids. |
| Whose data     | The submission always belongs to the caller (`sub`). The body cannot name another student.                                                                                                                            |

## 2. Request

```http
POST /labs/lab-sorting/submissions HTTP/1.1
Authorization: Bearer eyJhbGciOiJIUzI1NiJ9...
Idempotency-Key: 5f0c8d2e-3b1a-4c55-9a43-0d6c1f6e2b7a
Content-Type: application/json

{ "language": "cpp", "source": "#include <iostream>\nint main() { return 0; }\n" }
```

| Part                     | Rules                                                                                                                                                           |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Path `labId`             | The lab id as returned by the lab endpoints. An id that matches no lab gives `404 lab-not-found`.                                                               |
| Header `Idempotency-Key` | **Required.** 1–255 characters, printable ASCII only (`0x21`–`0x7E`). A UUID v4 is recommended. Missing or malformed gives `400 idempotency-key-missing`.       |
| Header `Content-Type`    | `application/json`. Any other type is treated as an empty body and gives `400 validation-error`.                                                                |
| Body                     | A JSON object with exactly the fields below. Unknown fields give `400 validation-error`. Raw body larger than 256 KiB gives `413 payload-too-large`.            |
| `language`               | Required. String, must be exactly `"cpp"` (the only language in scope).                                                                                         |
| `source`                 | Required. String, 1 to 65 536 bytes when encoded as UTF-8. Empty or longer gives `400 validation-error`. The server stores it byte for byte; it is not trimmed. |

## 3. Response

### 202 Accepted: submission created, or an earlier one replayed

```http
HTTP/1.1 202 Accepted
Location: /submissions/9b2f6a0e-8c3d-4f1e-b7a2-1d5e6c9f0a34
Content-Type: application/json

{
  "id": "9b2f6a0e-8c3d-4f1e-b7a2-1d5e6c9f0a34",
  "labId": "lab-sorting",
  "studentId": "student-17",
  "language": "cpp",
  "status": "queued",
  "createdAt": "2026-11-01T14:03:27.512Z"
}
```

| Field       | Type   | Rules                                                                     |
| ----------- | ------ | ------------------------------------------------------------------------- |
| `id`        | string | UUID, assigned by the server, never reused.                               |
| `labId`     | string | Equal to the path `labId`.                                                |
| `studentId` | string | Equal to the caller's `sub`.                                              |
| `language`  | string | Echo of the request: `"cpp"`.                                             |
| `status`    | string | Always `"queued"` in this response. Judging happens later, off this call. |
| `createdAt` | string | ISO 8601 UTC timestamp of the first, accepted request.                    |

Header `Location` is `/submissions/{id}`. A replayed response (section 5) also carries `Idempotent-Replayed: true`; a fresh one does not.

The status is `202`, not `201`, because the work this request starts (compile and judge) has not finished when the response is sent. Clients must ignore response fields they do not know (section 7).

## 4. Errors

Every error is `application/problem+json` per [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457). The body always has these members:

| Member     | Value                                                         |
| ---------- | ------------------------------------------------------------- |
| `type`     | `https://leettkob.dev/problems/<slug>`, slug from below.      |
| `title`    | The fixed title from the table below. Clients may rely on it. |
| `status`   | Same number as the HTTP status.                               |
| `detail`   | Human-readable, specific to this occurrence. Do not parse.    |
| `instance` | The request path, e.g. `/labs/lab-sorting/submissions`.       |

| Status | Slug                      | Title                                             | When                                                                                                   |
| ------ | ------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 400    | `validation-error`        | Request body is invalid                           | Body is not JSON, not an object, has unknown fields, or breaks a field rule in section 2.              |
| 400    | `idempotency-key-missing` | Idempotency-Key header is required                | `Idempotency-Key` is absent, empty, longer than 255 characters, or has non-printable-ASCII characters. |
| 401    | `unauthenticated`         | Authentication required                           | No bearer token, bad signature, expired, or a required claim missing or invalid.                       |
| 403    | `forbidden-role`          | Only students may submit                          | Valid token whose `role` is not `student`.                                                             |
| 404    | `lab-not-found`           | Lab not found                                     | No lab with this id, **or** the caller is not enrolled in the lab's class (section 1).                 |
| 409    | `lab-closed`              | Lab is closed for submissions                     | The lab's deadline has passed and this is not a replay of a request accepted before it.                |
| 413    | `payload-too-large`       | Request body is too large                         | Raw request body is larger than 256 KiB.                                                               |
| 422    | `idempotency-key-reused`  | Idempotency-Key was used with a different request | Same caller, same lab, same key, but a different `language` or `source` than the first request.        |
| 500    | `internal-error`          | Internal server error                             | Anything unexpected. `detail` never contains stack traces or secrets.                                  |

`validation-error` adds one extension member, `errors`: an array of `{ "path": string, "message": string }`, one per broken rule (`path` is the field name, or `""` for the whole body).

```json
{
  "type": "https://leettkob.dev/problems/validation-error",
  "title": "Request body is invalid",
  "status": 400,
  "detail": "1 field is invalid.",
  "instance": "/labs/lab-sorting/submissions",
  "errors": [
    { "path": "language", "message": "Invalid input: expected \"cpp\"" }
  ]
}
```

### Order of checks

When several errors apply, the first one in this order wins, so clients see a stable answer:

1. `401 unauthenticated`
2. `403 forbidden-role`
3. `413 payload-too-large`, then `400 validation-error` for an unparsable body
4. `400 idempotency-key-missing`
5. `400 validation-error` for field rules
6. `404 lab-not-found`
7. Idempotency lookup: replay (`202`) or `422 idempotency-key-reused`
8. `409 lab-closed`

Because step 7 comes before step 8, a client that retries after the deadline a request the server already accepted still gets its `202`.

## 5. Idempotency

| Rule       | Value                                                                                                                                                                                        |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scope      | `(caller sub, labId, Idempotency-Key)`. The same key from another student or for another lab is a different request.                                                                         |
| Same body  | Same scope and same `language` + `source` (compared byte for byte): returns `202` with the **stored** body (same `id`, same `createdAt`) and `Idempotent-Replayed: true`. No new submission. |
| Other body | Same scope, different `language` or `source`: `422 idempotency-key-reused`. Nothing is stored.                                                                                               |
| Errors     | Requests that fail (any 4xx or 5xx) store nothing; the key stays free and the client may retry with it.                                                                                      |
| Races      | Two concurrent requests with the same scope produce one submission; both get it back, one of them with `Idempotent-Replayed: true`.                                                          |
| Retention  | Keys are kept for at least 24 hours after the first accepted request.                                                                                                                        |

The scope is enforced by the repository with a unique key on `(student_id, lab_id, idempotency_key)`. PA#2 ships an in-memory repository behind the same interface; the PostgreSQL table with the unique index replaces it in PA#3 without changing this contract.

## 6. Side effects

A `202` that is not a replay:

- creates one submission owned by the caller, with status `queued`;
- puts one judge job on the submission queue (from PA#3; in PA#2 the record is only stored).

Nothing else changes. Errors and replays change nothing.

## 7. When this contract changes

- **Additive changes** (a new optional request field, a new response field, a new header) bump the revision and are listed in the changelog below. Clients must ignore response fields and headers they do not know.
- **Breaking changes** (a removed or renamed field, a stricter rule, a new error slug for an existing case, a different status) bump the revision, are announced to the team in the pull request, and change this file and `tests/contract/` in one commit **before** the code that implements them, never in the same commit.
- An error `type` URL, once published, keeps its meaning forever. A retired slug is never reused for a different case.

### Changelog

| Revision | Date       | Change         |
| -------- | ---------- | -------------- |
| 1        | 2026-11-01 | First version. |
