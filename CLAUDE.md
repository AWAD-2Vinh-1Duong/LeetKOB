@AGENTS.md

## Claude Code

The shared rules above (stack, commands, conventions, never list, permission tiers) apply first. The lines below only add Claude-specific behaviour; if they ever disagree with `AGENTS.md`, stop and ask.

### Working style

- Reply to the team in Vietnamese. Code, identifiers, commit messages and contract docs stay in English.
- Package manager is **npm only**.
- Start every change on a `feat/*`, `test/*`, `fix/*` or `gate/*` branch. If the current branch is `main`, create a branch before editing.
- Before saying a task is done, run `npm run check` and quote the real result. If it fails, say which step failed and why (e.g. the deliberate line in `src/app.js`) — never report a check as green that did not run.

### Rules with a story

- **Deliberate breaks live only on `gate/*` branches.** A lint-breaking line meant for `gate/ci-test` landed on `main` instead (commit `cfcb089`, `src/app.js`). Before committing any intentionally failing code, confirm `git branch --show-current` starts with `gate/`.
- **Never log work that does not exist yet.** An AI-LOG entry (2026-10-30) said `.github/workflows/ci.yml` was added, but the committed file is empty. Before writing an AI-LOG entry or commit summary, open the files it mentions and check they contain what you claim.
- **Only reference files that exist.** `README.md` and `.github/copilot-instructions.md` pointed agents at `AI-RULES.md`, which was never created. Before linking a path in docs, check it exists.
- **Command changes are repo-wide.** The npm switch left `pnpm` in `AGENTS.md` Tier 1 (fixed later). When renaming a command or tool, `grep` the whole repo (README, AGENTS.md, CI, scripts) and update every occurrence in the same change.
- **Format before committing.** The first `CLAUDE.md` Claude wrote failed `prettier --check`. After editing any file, run `npm run format` before committing.

### Contract & tests

- `docs/contract/*.md` is the source of truth. When code and a contract test disagree, fix the code. Change a test only together with a contract change, and never in the same commit as the code that makes it pass.
- Contract tests must assert the RFC 9457 body (`type`, `title`, `status`), not only the status code.
- Stub every model provider call in tests; tests must pass with the network off and no API key set.

### AI-LOG.md

- At the end of a session that produced code or docs, draft an entry using the template in `AI-LOG.md` (date as `YYYY-MM-DD`). Fill `Tool`, `Asked for` and `Kept`; leave `Changed` and `Rejected` for the human to write, since those record what _they_ corrected.
