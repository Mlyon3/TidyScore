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
        // The domain layer is the portable core: no DOM, no browser APIs, no app state,
        // and no imports from UI modules. It must run in a worker, Node, or a native port.
        files: ['src/domain/**/*.js'],
        rules: {
            'no-restricted-globals': ['error', ...[
                'document', 'window', 'navigator', 'localStorage', 'sessionStorage', 'indexedDB',
                'location', 'history', 'self', 'Worker', 'FileReader', 'Blob', 'File', 'URL',
                'requestAnimationFrame', 'setTimeout', 'clearTimeout', 'fetch', 'alert', 'confirm'
            ].map(name => ({ name, message: 'src/domain must stay platform-neutral.' }))],
            'no-restricted-imports': ['error', {
                patterns: [{
                    group: ['../core/*', '../ui/*', '../tools/*', '../workers/*', '../main.js', '../bootstrap.js', '../pwa.js'],
                    message: 'src/domain must not depend on UI or app-state modules.'
                }]
            }],
            'no-restricted-syntax': ['error', {
                selector: 'ThisExpression',
                message: 'Domain functions are pure; pass state in as arguments.'
            }]
        }
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
        files: ['test/**/*.js', 'e2e/**/*.js', 'e2e-pwa/**/*.js', 'scripts/**/*.js'],
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
