// ESLint — legacy config (eslint 8 + eslint-config-expo).
// Les règles stylistiques sont en `warn` (codebase legacy, pas d'autofix massif) ;
// seules les règles de hooks sont en `error` car elles attrapent de vrais bugs.
module.exports = {
  root: true,
  extends: ['expo'],
  env: {
    // Timers (setTimeout/setInterval), console, Intl… — globals RN standard
    node: true,
    browser: true,
  },
  overrides: [
    {
      files: ['**/__tests__/**/*.js', '**/*.test.js'],
      env: { jest: true },
    },
  ],
  rules: {
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
    'no-var': 'warn',
    'prefer-const': 'warn',
  },
};
