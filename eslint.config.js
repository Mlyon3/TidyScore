import js from '@eslint/js';
import globals from 'globals';
import promise from 'eslint-plugin-promise';

const qualityRules = {
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-prototype-builtins': 'error',
    'no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_'
    }],
    'promise/catch-or-return': ['error', { allowFinally: true }],
    'promise/no-multiple-resolved': 'error',
    'promise/no-return-in-finally': 'error',
    'promise/no-return-wrap': 'error',
    'promise/valid-params': 'error'
};

export default [
    {
        ignores: [
            'dist/**',
            'node_modules/**',
            'playwright-report/**',
            'test-results/**'
        ]
    },
    js.configs.recommended,
    {
        files: ['src/**/*.js'],
        plugins: { promise },
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: globals.browser
        },
        rules: qualityRules
    },
    {
        files: ['src/workers/**/*.js'],
        languageOptions: {
            globals: globals.serviceworker
        }
    },
    {
        files: ['public/**/*.js'],
        plugins: { promise },
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'script',
            globals: globals.serviceworker
        },
        rules: qualityRules
    },
    {
        files: ['test/**/*.js', 'e2e/**/*.js', 'e2e-pwa/**/*.js'],
        plugins: { promise },
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: {
                ...globals.node,
                ...globals.browser
            }
        },
        rules: qualityRules
    },
    {
        files: ['*.config.js'],
        plugins: { promise },
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: {
                ...globals.node,
                ...globals.serviceworker
            }
        },
        rules: qualityRules
    }
];
