import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const sharedConfig = require('../shared/eslint.config.shared.js');

export default [
  ...sharedConfig,
  {
    files: ['**/*.ts', '**/*.js'],
    ignores: ['**/generated/**', '**/dist/**', '**/node_modules/**'],
    rules: {
      // API-specific rules
      'no-console': 'off', // Allow console for server logging
      '@typescript-eslint/no-unused-vars': ['error', { 
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_'
      }],
    },
  },
  {
    ignores: ['src/generated/**/*'],
  },
];