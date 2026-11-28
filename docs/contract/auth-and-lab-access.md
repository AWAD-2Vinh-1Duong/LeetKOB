# Auth and class access

Revision 2. Source of truth for `POST /auth/login`, `GET /labs/{labId}` and who may open `GET /labs/{labId}/review-queue`. Errors are RFC 9457 problem details with `type` = `https://leettkob.dev/problems/<slug>`. Problems shared with `post-labs-submissions.md` keep the same slug and status.

## 1. POST /auth/login

- Body: `{ "email": string, "password": string }`, no other field.
- 200: `{ "token": string, "tokenType": "Bearer", "expiresIn": 3600 }`. The token is an HS256 JWT with `sub` (user id), `role` (`admin`, `ta` or `student`) and `exp`.
- Passwords are stored as salted `scrypt` hashes, never as plain text.

| Status | Slug                  | When                                                                                                                     |
| ------ | --------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| 400    | `validation-error`    | The body is not JSON, a field is missing or not a string, or there is an unknown field.                                  |
| 401    | `invalid-credentials` | Unknown email or wrong password. Same status, slug and detail for both, so the response does not say which emails exist. |

## 2. Class access

A lab belongs to one class. Who can see it:

- `admin`: every lab.
- `ta`: labs of the classes the TA teaches (`class_staff`).
- `student`: labs of the classes the student is enrolled in.

Anyone else gets `404 lab-not-found`, the same as for a lab that does not exist, so a TA of another class cannot tell that the lab exists.

## 3. GET /labs/{labId}

- 200: `{ "id", "classId", "deadline" }` for anyone who can see the lab.
- 401 `unauthenticated`: no valid bearer token.
- 404 `lab-not-found`: the lab does not exist or the caller cannot see it.

## 4. GET /labs/{labId}/review-queue

The TA's review queue. This section fixes who may open it; its content, and `PUT /labs/{labId}/review-queue/{verdictId}`, are in `review-queue.md`.

- 200: `{ "items": [...] }` for an `admin` or a `ta` of the lab's class (`{ "items": [] }` while the lab has no judged submission).
- 401 `unauthenticated`: no valid bearer token.
- 404 `lab-not-found`: the lab does not exist or the caller cannot see it (this check comes first).
- 403 `staff-only`: the caller can see the lab but is a student.
