import js from '@eslint/js';
import globals from 'globals';

// ESLint only loads a default export from this file: the one allowed
// exception to the named-exports rule in AGENTS.md.
export default [
  // The lecturer's dev set is kept verbatim, never linted or edited.
  { ignores: ['eval/dev-set/**'] },
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
];
