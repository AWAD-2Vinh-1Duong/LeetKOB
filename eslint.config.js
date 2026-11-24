import js from '@eslint/js';
import globals from 'globals';

// Layer boundaries (docs/architecture.md). A later block replaces the rule of an earlier
// one for the same file, so each layer lists everything it may not import.
const MEMORY_REPO = '**/*.repository.memory.js';
const POSTGRES_REPO = '**/*.repository.postgres.js';
const ANY_REPO = '**/*.repository*.js';
const SERVICE = '**/*.service.js';
const CONTROLLER = '**/*.controller.js';
const ROUTES = '**/*.routes.js';

/**
 * @param {string[]} groups import patterns the layer may not use
 * @param {string} message why
 * @param {string[]} [packages] package names the layer may not import
 */
const restrict = (groups, message, packages = []) => ({
  'no-restricted-imports': [
    'error',
    {
      paths: packages.map((name) => ({ name, message })),
      patterns: [{ group: groups, message }],
    },
  ],
});

// ESLint only loads a default export from this file: the one allowed
// exception to the named-exports rule in AGENTS.md.
export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.node,
    },
  },
  {
    files: ['src/**/*.js'],
    rules: {
      'no-console': 'error',
    },
  },
  // Everything except the container: no concrete repository, no `pg`.
  {
    files: ['src/**/*.js'],
    ignores: [
      'src/container.js',
      'src/modules/*/repository/*.repository.postgres.js',
      'src/shared/db.js',
    ],
    rules: restrict(
      [MEMORY_REPO, POSTGRES_REPO],
      'Only src/container.js imports a concrete repository. Depend on the interface in <feature>.repository.js.',
      ['pg'],
    ),
  },
  {
    files: ['src/middlewares/**/*.js'],
    rules: restrict(
      [SERVICE, ANY_REPO, CONTROLLER, ROUTES],
      'Middleware handles HTTP checks that need no data.',
      ['pg'],
    ),
  },
  {
    files: ['src/**/*.routes.js'],
    rules: restrict(
      [SERVICE, ANY_REPO, MEMORY_REPO, POSTGRES_REPO],
      'A routes file only maps paths to controller methods and middleware.',
      ['pg'],
    ),
  },
  {
    files: ['src/**/*.controller.js'],
    rules: restrict(
      [ANY_REPO, MEMORY_REPO, POSTGRES_REPO, ROUTES],
      'A controller reads the request and calls a service. It never touches a repository.',
      ['pg'],
    ),
  },
  {
    files: ['src/**/*.service.js'],
    rules: restrict(
      [CONTROLLER, ROUTES, MEMORY_REPO, POSTGRES_REPO],
      'A service holds the rules and knows nothing about HTTP or a concrete database.',
      ['pg', 'express'],
    ),
  },
  {
    files: ['src/**/*.repository.memory.js', 'src/**/*.repository.postgres.js'],
    rules: restrict(
      [SERVICE, CONTROLLER, ROUTES],
      'A repository only stores and reads data.',
      ['express'],
    ),
  },
];
