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
