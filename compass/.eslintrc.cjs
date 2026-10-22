const path = require('node:path');

const reactAppConfig = require.resolve('eslint-config-react-app', {
    paths: [
        path.dirname(
            require.resolve('./static/application/node_modules/react-scripts/package.json')
        )
    ]
});

module.exports = {
    root: true,
    env: { node: true, es2022: true },
    parserOptions: { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } },
    extends: ['eslint:recommended', 'prettier'],
    overrides: [
        { files: ['*.cjs'], parserOptions: { sourceType: 'script' } },
        {
            files: ['src/**/*.ts', 'shared/**/*.ts'],
            parser: '@typescript-eslint/parser',
            extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'prettier']
        },
        {
            files: ['static/application/src/**/*.{js,ts,tsx}'],
            env: { browser: true, node: false },
            extends: [reactAppConfig, 'prettier']
        },
        { files: ['**/*.test.{js,ts,tsx}'], env: { jest: true } }
    ]
};
