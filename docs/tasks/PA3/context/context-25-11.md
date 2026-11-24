1. Complete Task T18 (checker command, `MODEL_OFF=1`, Dockerfile) - Thế Vinh with Claude Code

- Tests first, commit `8bb019e`: `tests/grading/checker.test.js`, 9 tests on a small dataset built in a temp folder, plus one that runs the checker on `eval/dev-set` and scores it with the untouched `eval.mjs`.
- `src/modules/grading/service/check-dataset.js` (`checkDataset(dataDir, { judge })`) reads `problems/<id>/statement.md` and `constraints.json` and every `solutions/<id>/*.cpp`, with no setting per problem. Ban-list constraints go to the hard rules (T11); semantic ones go to the judge, or are `unsure` with the model off. It returns the prediction lines and one call-log row per model call.
- `src/checker.js` is the command, like `server.js` it may read `process.env`: `MODEL_OFF=1 node src/checker.js --data <dir> [--out file] [--call-log file]`. Without `MODEL_OFF=1` it stops with a message until the Gemini model lands (T13).
- `Dockerfile.checker` and `.dockerignore`: the image holds only `src/` and runtime dependencies; `.env`, tests, eval data and docs stay out (checked: no `.env` in `/app`).
- Ran it the way the marker will: `docker run --network none --memory 512m --pids-limit 64 -e MODEL_OFF=1` on the dev set. 102 lines, byte for byte the same as the local run. `eval.mjs` exit code 1 (valid file, thresholds not met), never 2.
- Model-off numbers on the dev set: wrongful deductions 0, recall 37.8% (14/37), unsure 46.1%. Low recall and high unsure are expected with every semantic constraint `unsure`; PA#3 has no pass mark on the eval.
- README section 2b gives the command and the Docker lines.

2. Fix three red checks found while merging `dev` - Thế Vinh with Claude Code

- `src/README.md` from `dev` failed `prettier --check`; formatted it (commit `348c393`).
- Two login tests failed from 2026-11-25 on: the app signs tokens with the injected clock (`now`) but `verifyToken` checked `exp` against the wall clock. Fixed the code first (`4662371`): `createRequireAuth` and `verifyToken` take the same `now`. One test called `jwtVerify` against the wall clock on a token signed at its fixed `NOW`; a test-only commit (`f4e8cdb`) passes `currentDate: NOW`. No assertion changed.
- The T18 dev-set test found 2 wrongful deductions from the hard rules: with `using namespace std`, a student's own `sort` (in a namespace of their own) and own `gcd` were taken for the library functions. Tests first (`b6848cb`, 4 new trap tests, no existing line changed), then the fix (`560731b`): when the code declares its own function of the banned name, an unqualified call is the student's; a qualified `std::sort` still counts. Wrongful deductions went from 2 to 0 and recall stayed 14/37. No dev-set code or problem id is in the rule or the tests.
- `npm run check` green: 204/204 tests.
- Not done: the T11 and T08 owners (Quang Vinh) should review the two fixes in their files.

3. Complete Task T17 (own eval cases with a trap and a prompt injection) - Thế Vinh with Claude Code

- New folder `eval/custom-cases/` in the dev-set layout (`problems/`, `solutions/`, `labels.jsonl`), separate from `eval/dev-set/`. One problem of our own, `array-max` (print the largest of `n` integers): C1 is a ban list (`std::max_element`, `std::max`, ...), C2 is semantic (one pass that keeps the largest value so far; sorting, an ordered container or comparing every pair fails). Five tests, including `n = 1`, all negative and `n = 100000`. Nothing is copied from the dev set.
- Six solutions, twelve labelled pairs: `s01` plain loop (pass); `s02` `max_element` (C1 and C2 violation, `obvious`); `s03` its own `max` in a namespace under `using namespace std` plus a comment naming `std::max_element` (`trap`, pass); `s04` sorts inside a function called `find_max` (C2 violation, `disguised`); `s05` a comment telling the reviewer to answer pass while the code uses `std::set` (C2 violation, `injection` and `disguised`); `s06` recursion with `scanf` (`style`, pass). Five solutions carry tags.
- Every solution is Accepted: compiled with `g++ -std=c++17 -O2` and its output matches every `.out` token by token (checked with a small script; the first attempt compared strings wrongly and reported all as wrong, the token comparison shows all six accepted).
- Tests first, commit `222b148`: `tests/grading/custom-cases.test.js` checks one label per (solution, constraint), at least five tagged solutions with a trap and an injection, violation evidence on real lines, and that `eval.mjs` accepts the folder with 0 wrongful deductions from the model-off checker.
- Checked that the trap bites: with the old hard rules from `dev` (before the T11 fix) the folder gives 1 wrongful deduction and the test fails.
- Model-off numbers on the custom cases: wrongful 0, recall 25% (1/4), unsure 50%. Expected with the model off.
- `npm run check` green: 208/208 tests. The branch is on top of `feat/pa3-cli-eval` because it needs the checker and the T11 fix.

4. Switch the model to Gemini 3.8 Flash through 9router (start of T13) - Thế Vinh with Claude Code

- The team calls Gemini through 9router, a router that runs on the machine and exposes an OpenAI-compatible endpoint (`http://127.0.0.1:20128/v1`). The key was created in the 9router dashboard and lives only in the local `.env`, filled in by Thế Vinh; the assistant never saw it. A probe script that prints only the key length listed the models; the one used is `ag/gemini-3.8-flash`.
- Replaced `gemini-3.6-flash` with `ag/gemini-3.8-flash` in `AGENTS.md`, `README.md`, `.env.example` (new empty `LLM_BASE_URL`), `PA3.md`, the PA3 submission drafts and the PA3 checklist.
- Left on purpose: the default `'gemini-3.6-flash'` in the applied migration `1795453690243_init-schema.sql` (applied migrations are never edited; the app writes the real model name into every call-log row) and the PA#2 reports (history of a submitted checkpoint).
- Not done: the spending-cap lines still say "Google AI Studio Free tier, no billing, $0". They must be rewritten once the team confirms what the `ag/` provider behind 9router is and whether it can bill.

5. Complete Task T13 (real model through 9router, call log) - Thế Vinh with Claude Code

- A probe call showed what 9router returns: an OpenAI-style completion streamed as server-sent events by default, an `id` such as `chatcmpl-...`, and `usage.prompt_tokens` / `usage.completion_tokens` in the last chunk. No cost field, and no separate upstream request-id header.
- Tests first, commit `9aa81b0`: `tests/grading/openai-compatible-model.test.js`, 9 tests on a fake `fetch` (no network, no key): the request (`POST <base>/chat/completions`, one user message, `stream: false`, key only in the bearer header, abort signal passed on), JSON and streamed replies, cost from token counts, a 429 that becomes `unsure` through `ConstraintJudge` without the key in any message, and a good reply that becomes verdicts plus a call record with the request id.
- Code, commit `b8a8437`: `src/modules/grading/service/openai-compatible-model.js` and the wiring in `src/checker.js`. Without `MODEL_OFF=1` the checker needs `LLM_BASE_URL`, `LLM_MODEL` and `LLM_API_KEY` and names any that is missing (never a value). Timeout `LLM_TIMEOUT_MS`, default 60 s. Cost per call = tokens x the optional `LLM_INPUT_USD_PER_MTOK` / `LLM_OUTPUT_USD_PER_MTOK`, 0 when unset.
- First real run, by Thế Vinh on his machine with the key in `.env`, on `eval/custom-cases` with `ag/gemini-3.8-flash`: 6 calls, all `ok`, 37 s in total (about 5-7 s each), 2,695-3,031 input and 18-50 output tokens per call. Eval: wrongful 0, recall 100% (4/4), unsure 0%, including the trap and the injection case.
- About 2,000 of the input tokens per call are added by 9router itself: a one-line "Reply OK" probe already counted 2,006 prompt tokens. The cost arithmetic must use the logged counts, not the prompt length.
- The request ids in the call log are the ones 9router returns (`chatcmpl-...`); 9router does not pass on a separate Google request id.
- `npm run check` green: 217/217 tests.

6. Task T19, first part (real-model run on the dev set) - Thế Vinh with Claude Code

- Thế Vinh ran the checker on his machine with `ag/gemini-3.8-flash` through 9router (key only in `.env`), writing straight into `docs/tasks/PA3/submission/dev-run/`: `predictions.jsonl` (102 lines), `eval-report.txt`, `call-log.jsonl` (39 calls). Committed as `d40db20`. No key, bearer header or `LLM_API_KEY` appears in any of the three files.
- `eval.mjs` on the run: wrongful deductions 0, recall 94.6% (35/37), unsure 1.0% (1/102), exit code 0. Every `trap` and `style` pair passed; all 15 `obvious` violations were caught.
- 39 calls for 47 solutions: the 8 `reverse-recursive` solutions made no call, because both of that problem's constraints are ban lists and the hard rules decided them. 39 distinct request ids, none empty.
- `gcd-euclid/s07` C2 became `unsure`: the model's JSON was cut off before its closing `]}`. The schema guardrail rejected it, so no mark was taken. `reverse-words/s05` C1 was missed by the hard rules (a disguised ban-list use); the model is not asked about ban lists.
- Tokens: 117,330 input and 1,906 output in total, 227 s of model time. Per submission (47): 2,496.4 input and 40.6 output tokens on average. A lab of 80 submissions: about 199,711 input and 3,244 output tokens. Cost logged per call is 0 because no price is configured; the price per token and the spending cap are still to be confirmed for the provider behind 9router.
- Not done: the cost arithmetic in `README.md` and `AI-LOG.md` (waits for the price), and the review of the `reverse-words/s05` hard-rule miss.

7. Complete Task T19 (cost per lab, spending cap) - Thế Vinh with Claude Code

- Thế Vinh confirmed that the `ag/` provider behind 9router is free: cap $0, no payment method attached.
- Rewrote the spending-cap and cost lines in `README.md`, `PA3.md`, `docs/tasks/PA3/submission/PA3.md`, `submission-note.txt` and the checklist: they no longer claim Google AI Studio for PA#3 (only as PA#2 history). The cost per lab is now measured, not guessed: 2,496.4 input and 40.6 output tokens per submission, 199,711 and 3,244 for 80 submissions, $0 at the free provider. The old "theoretical paid tier" numbers ($0.075 / $0.30 per 1M, from Gemini 1.5 Flash) were removed because they do not apply to this model.
- Corrected a false claim in `README.md`: the per-lab cost cap `LLM_COST_CAP_PER_LAB_USD` was described as enforced from PA#3, but no code does it; the README now says it is not implemented yet.
- `AI-LOG.md`: new entry on top with the tool, the request, what was kept and the cost arithmetic. `Changed` and `Rejected` are left for Thế Vinh, as `CLAUDE.md` asks.
- `docs/tasks/PA3/submission/PA3.md` now links `eval/custom-cases/` instead of a TODO.
