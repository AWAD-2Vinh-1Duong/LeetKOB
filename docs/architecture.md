# Architecture of the LeeTKOB app

One Express process. Code is grouped **by feature**, and inside a feature by **layer**. Objects are built in one place, `src/container.js`. The rules below are checked by ESLint (`eslint.config.js`), so breaking one turns `npm run check` red.

## 1. Layout

```
src/
  server.js          starts the process: reads config, opens the pool, listens
  config.js          reads process.env once (the only file besides server.js that may)
  container.js       composition root: builds repositories, services, controllers
  app.js             builds Express: request context, routers, error handler
  shared/            problems.js (RFC 9457), validation.js, error-handler.js,
                     request-context.js, db.js (the pg pool)
  auth/              login, tokens, passwords, requireAuth middleware, users store
  labs/              create and read labs, review queue access
  submissions/       submit code, read a submission's status
  rules/             hard rules (pure functions, no I/O)
migrations/          SQL for node-pg-migrate
tests/<feature>/     one folder per feature, same names as src
docs/contract/       one contract per endpoint group: the source of truth
```

A feature folder holds files named `<feature>.<layer>.js`:

| File                          | Layer      | What it does                                                                          |
| ----------------------------- | ---------- | ------------------------------------------------------------------------------------- |
| `labs.routes.js`              | routes     | Maps method and path to a controller method, adds middleware.                         |
| `labs.controller.js`          | controller | Reads the request, validates the body with zod, calls a service, writes the response. |
| `labs.service.js`             | service    | Holds the rules: who may do what, ordering of checks, idempotency.                    |
| `labs.repository.js`          | interface  | JSDoc typedefs only (`export {}`): the methods a store must have.                     |
| `labs.repository.postgres.js` | repository | SQL against PostgreSQL. This is what the app runs.                                    |
| `labs.repository.memory.js`   | repository | A fake for tests. Never used by the server.                                           |

## 2. What each layer may import

| Layer           | May use                                        | May not use                                                        |
| --------------- | ---------------------------------------------- | ------------------------------------------------------------------ |
| routes          | its controller, `requireAuth`, `express`       | services, repositories                                             |
| controller      | services, `shared/`, `zod`, `auth/roles.js`    | repositories, routes, `pg`                                         |
| service         | repository **interfaces**, `shared/`, `rules/` | `express`, controllers, routes, `pg`, concrete repositories        |
| repository      | `pg`, `shared/`                                | `express`, services, controllers, routes                           |
| everything else | —                                              | a `*.repository.postgres.js` or `*.repository.memory.js`, and `pg` |

Only `src/container.js` imports a concrete repository. Only `shared/db.js` and `*.repository.postgres.js` import `pg`.

## 3. One request, end to end

```
HTTP -> app.js (request id) -> router -> requireAuth -> controller
     -> zod parse -> service -> repository interface -> PostgreSQL
     <- result <- ... <- controller writes JSON
Any throw -> shared/error-handler.js -> RFC 9457 problem
```

## 4. Dependency injection

- Dependencies come in through the **constructor**, as one object: `new LabService({ labRepository })`.
- Only `createContainer` calls `new` on repositories, services and controllers. A class never builds its own collaborators and never reads `process.env`.
- `createContainer({ jwtSecret, pool })` runs on PostgreSQL. Tests call `createApp({ jwtSecret, labRepository, ... })` with the in-memory repositories; a repository you pass wins over the one built from `pool`.
- No DI library. If the container grows past one screen, split it by feature (`createLabsModule(...)`), do not add a framework.

## 5. Rules for the code

1. **Errors.** Throw `new ProblemError('<slug>', 'detail')`. Never send a response from a service. Never build `{ code, message }` by hand. A new slug needs a row in `shared/problems.js` and in the contract.
2. **Validation.** A controller parses the body with `parseBody(schema, req.body)`. A service takes already-valid input.
3. **Not-found and not-allowed look the same** when the difference would leak that something exists (another class's lab, another student's submission): return 404 with the same body as a missing id.
4. **Roles.** Use `assertStaff` from `auth/roles.js` for the "students may not" rule. Class access is a repository question (`findForUser`), not an `if` in a controller.
5. **Config.** Add a setting to `loadConfig`, then pass it through the container. Add it to `.env.example` with an empty value.
6. **No `console.log`** in `src/`; log with the request logger (`req.log`) or the injected `logger`.
7. **Named exports only**, except tool configs such as `eslint.config.js`.

## 6. Adding a feature (checklist, in this order)

1. Write or extend the contract in `docs/contract/` (statuses, slugs, who may call it).
2. Write the tests in `tests/<feature>/` and commit them. They fail.
3. Create `src/<feature>/` with `<feature>.repository.js` (interface), the `.postgres.js` and `.memory.js` implementations, the service, the controller and the routes.
4. If you need a table, add a **new** migration in `migrations/` (never edit an applied one). A migration needs the team's approval first.
5. Register it in `src/container.js` and mount its router in `src/app.js`.
6. Run `npm run check`. Run the tests once against PostgreSQL too: `DATABASE_URL=... npm run db:migrate && DATABASE_URL=... npm test`.
7. Log it in `docs/tasks/PA<n>/context/context-dd-mm.md`.

## 7. Tests

- Contract tests go through `createApp` and `supertest`, on the in-memory repositories. Each feature that has SQL also has a `*-postgres.test.js` that skips when `DATABASE_URL` is not set.
- Unit tests of pure code (`rules/`, `config.js`, `passwords.js`) call the function directly.
- `npm test` runs files one at a time (`--test-concurrency=1`) because the PostgreSQL tests share tables.
- A test may import a `*.repository.memory.js`. `src/` may not.
