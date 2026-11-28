# Architecture of the LeeTKOB app

One Express process. Code is grouped **by feature**, and inside a feature by **layer**. Objects are built in one place, `src/container.js`. The rules below are checked by ESLint (`eslint.config.js`), so breaking one turns `npm run check` red.

## 1. Layout

```
src/
  server.js          starts the process, opens the pool and listens
  config.js          reads process.env (server.js may also read it)
  container.js       builds repositories, services and controllers
  app.js             mounts request context, routers and error handling
  middlewares/       HTTP middleware, exported through index.js
  modules/
    auth/
      controller/    login controller and routes
      service/       login, roles, passwords and tokens
      repository/    users interface and stores
    grading/
      service/       C++ tokenizer and hard rules
    labs/
      controller/    lab and review queue routes and controllers
      service/       lab creation, visibility and review queue access
      repository/    labs interface and stores
    submissions/
      controller/    submission routes and controller
      service/       submission creation, idempotency and visibility
      repository/    submissions interface and stores
  shared/            problems.js, validation.js and db.js
migrations/          SQL for node-pg-migrate
tests/               unit, middleware, contract and PostgreSQL tests
docs/contract/       endpoint contracts
```

Feature layers live in `src/modules/<module>/`. HTTP middleware lives in `src/middlewares/`.

| File                          | Layer      | What it does                                                                          |
| ----------------------------- | ---------- | ------------------------------------------------------------------------------------- |
| `require-auth.middleware.js`  | middleware | Handles HTTP checks that need no data and attaches request values to `res.locals`.    |
| `labs.routes.js`              | routes     | Maps method and path to a controller method, adds middleware.                         |
| `labs.controller.js`          | controller | Reads the request, validates the body with zod, calls a service, writes the response. |
| `labs.service.js`             | service    | Holds the rules: who may do what, ordering of checks, idempotency.                    |
| `labs.repository.js`          | interface  | JSDoc typedefs only (`export {}`): the methods a store must have.                     |
| `labs.repository.postgres.js` | repository | SQL against PostgreSQL. This is what the app runs.                                    |
| `labs.repository.memory.js`   | repository | A fake for tests. Never used by the server.                                           |

## 2. What each layer may import

| Layer           | May use                                                              | May not use                                                        |
| --------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------ |
| routes          | its controller, `src/middlewares/`, `express`                        | services, repositories, `pg`                                       |
| middleware      | `express`, `src/shared/`, auth token helpers                         | service classes, repositories, controllers, routes, `pg`           |
| controller      | services, `src/shared/`, `zod`                                       | repositories, routes, `pg`                                         |
| service         | repository interfaces, `src/shared/`, `src/modules/grading/service/` | `express`, controllers, routes, `pg`, concrete repositories        |
| repository      | `pg`, `shared/`                                                      | `express`, services, controllers, routes                           |
| everything else | —                                                                    | a `*.repository.postgres.js` or `*.repository.memory.js`, and `pg` |

Only `src/container.js` imports a concrete repository. Only `src/shared/db.js` and `*.repository.postgres.js` import `pg`.

## 3. One submission request, end to end

```
HTTP -> app.js (request id) -> router
     -> requireAuth -> requireRole -> jsonBody -> requireIdempotencyKey
     -> controller -> zod parse -> service -> repository interface -> PostgreSQL
     <- result <- ... <- controller writes JSON
Any throw -> src/middlewares/error-handler.middleware.js -> RFC 9457 problem
```

## 4. Dependency injection

- Dependencies come in through the **constructor**, as one object: `new LabService({ labRepository })`.
- Only `createContainer` calls `new` on repositories, services and controllers. A class never builds its own collaborators and never reads `process.env`.
- `createContainer({ jwtSecret, pool })` runs on PostgreSQL. Tests call `createApp({ jwtSecret, labRepository, ... })` with the in-memory repositories; a repository you pass wins over the one built from `pool`.
- No DI library. If the container grows past one screen, split it by feature (`createLabsModule(...)`), do not add a framework.

## 5. Rules for the code

1. **Errors.** Throw `new ProblemError('<slug>', 'detail')`. Never send a response from a service. Never build `{ code, message }` by hand. A new slug needs a row in `src/shared/problems.js` and in the contract.
2. **Validation.** A controller parses the body with `parseBody(schema, req.body)`. A service takes already-valid input.
3. **Not-found and not-allowed look the same** when the difference would leak that something exists (another class's lab, another student's submission): return 404 with the same body as a missing id.
4. **Authorization.** Checks that need no data go in middleware. Checks that need data go in a service. For example, the review queue service checks lab visibility before invoking `assertStaff` from `src/modules/auth/service/roles.js`.
5. **Config.** Add a setting to `loadConfig`, then pass it through the container. Add it to `.env.example` with an empty value.
6. **No `console.log`** in `src/`; log with the request logger (`req.log`) or the injected `logger`.
7. **Named exports only**, except tool configs such as `eslint.config.js`.

## 6. Adding a feature (checklist, in this order)

1. Write or extend the contract in `docs/contract/` (statuses, slugs, who may call it).
2. Write the tests in `tests/<feature>/` and commit them. They fail.
3. Create the feature in `src/modules/<module>/`. Put routes and controllers in `controller/`, business logic in `service/`, and the repository interface and both implementations in `repository/`. Place HTTP middleware in `src/middlewares/` and export it from `src/middlewares/index.js`.
4. If you need a table, add a **new** migration in `migrations/` (never edit an applied one). A migration needs the team's approval first.
5. Register it in `src/container.js` and mount its router in `src/app.js`.
6. Run `npm run check`. Run the tests once against PostgreSQL too: `DATABASE_URL=... npm run db:migrate && DATABASE_URL=... npm test`.
7. Log it in `docs/tasks/PA<n>/context/context-dd-mm.md`.

## 7. Tests

- Contract tests go through `createApp` and `supertest`, on the in-memory repositories. Each feature that has SQL also has a `*-postgres.test.js` that skips when `DATABASE_URL` is not set.
- Unit tests of pure code (such as `src/modules/grading/service/hard-rules.js`, `src/config.js` and `src/modules/auth/service/passwords.js`) call the function directly.
- `npm test` runs files one at a time (`--test-concurrency=1`) because the PostgreSQL tests share tables.
- A test may import a `*.repository.memory.js`. `src/` may not.
