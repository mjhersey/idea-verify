import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const sharedConfig = require('../shared/eslint.config.shared.js');

export default [
  ...sharedConfig,
  {
    files: ['**/*.ts', '**/*.js'],
    rules: {
      // API-specific rules
      'no-console': 'off', // Allow console for server logging
    },
  },
];