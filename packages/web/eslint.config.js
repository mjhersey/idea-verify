const sharedConfig = require('../shared/eslint.config.shared.js');

module.exports = [
  ...sharedConfig,
  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: require('vue-eslint-parser'),
      parserOptions: {
        parser: '@typescript-eslint/parser',
        ecmaVersion: 2022,
        sourceType: 'module',
      },
      globals: {
        // Browser globals
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        fetch: 'readonly',
        HTMLElement: 'readonly',
        Event: 'readonly',
        EventTarget: 'readonly',
        crypto: 'readonly',
      },
    },
    plugins: {
      'vue': require('eslint-plugin-vue'),
    },
    rules: {
      ...require('eslint-plugin-vue').configs['vue3-recommended'].rules,
      // Vue-specific rules
      'vue/multi-word-component-names': 'off',
      'vue/no-unused-vars': 'error',
      'vue/script-setup-uses-vars': 'error',
      'no-console': 'warn',
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      globals: {
        // Browser globals for TypeScript files
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        fetch: 'readonly',
        HTMLElement: 'readonly',
        Event: 'readonly',
        EventTarget: 'readonly',
        crypto: 'readonly',
      },
    },
  },
];