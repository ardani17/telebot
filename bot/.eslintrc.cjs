module.exports = {
  extends: ['../.eslintrc.cjs'],
  env: {
    node: true,
  },
  ignorePatterns: ['.eslintrc.cjs'],
  rules: {
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'no-console': 'off', // Allow console in bot for logging
    'prefer-const': 'error',
    'no-var': 'error',
  },
}; 