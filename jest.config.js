/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts', '**/index.test.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json'],
};
