/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts', '**/index.test.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json'],
  // V8 provider avoids source instrumentation that injects cov_* globals into
  // functions serialized and executed in a browser context (e.g. page.evaluate).
  coverageProvider: 'v8',
};
