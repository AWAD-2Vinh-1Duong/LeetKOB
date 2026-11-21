# PA#3 — Prototype with the LLM Feature Running

- **Team:** AWAD-2Vinh-1Duong (`23120242` — Nguyễn Văn Bình Dương, `<MSSV_QuangVinh>` — Quang Vinh, `<MSSV_TheVinh>` — Thế Vinh)
- **Repository:** https://github.com/AWAD-2Vinh-1Duong/LeetKOB
- **Submitted Tag:** `pa3`

## 1. Public Deployment & Test Accounts

- **Public URL:** `<https://your-deployment-url>` *(kept running until PA#4 marks are out)*
- **API Spending Cap:** `$0 USD` (Google AI Studio Free tier — `gemini-3.6-flash`, no billing account attached)

> **Note:** All accounts below contain synthetic test data only.

| Role | Class | Email / Username | Password |
| :--- | :--- | :--- | :--- |
| **Admin** | All | `<admin@leetkob.local>` | `<test-password>` |
| **TA 1** | `<Class A (e.g. CQ2023-3A)>` | `<ta1@leetkob.local>` | `<test-password>` |
| **TA 2** | `<Class B (e.g. CQ2023-3B)>` | `<ta2@leetkob.local>` | `<test-password>` |
| **Student 1** | `<Class A>` | `<student1@leetkob.local>` | `<test-password>` |
| **Student 2** | `<Class A>` | `<student2@leetkob.local>` | `<test-password>` |

## 2. CI Run for `pa3` Tag (Including Sandbox Attack Tests)

- **GitHub Actions CI Run (`pa3` tag):** `<https://github.com/AWAD-2Vinh-1Duong/LeetKOB/actions/runs/...>`
- **Included Checks:** `npm run check` (`lint`, `format:check`, `typecheck`, `contract/unit tests`), 9 sandbox minimum attack submissions (`M1`–`M9`), and CLI checker smoke test with `MODEL_OFF=1`.

## 3. CLI Checker, Docker Build & `MODEL_OFF=1`

- **Build Checker Docker Image:**
  ```bash
  docker build -f Dockerfile.checker -t leetkob-checker:pa3 .