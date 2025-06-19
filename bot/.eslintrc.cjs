module.exports = {
  extends: ['../.eslintrc.cjs'],
  env: {
    node: true,
  },
  ignorePatterns: ['.eslintrc.cjs'],
  rules: {
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'off', // Disabled untuk fleksibilitas development
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-empty-function': 'off', // Allow empty functions untuk callbacks
    'no-console': 'off', // Allow console in bot for logging
    'prefer-const': 'error',
    'no-var': 'error',
  },
}; 