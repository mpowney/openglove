const base = require('./jest.config');

module.exports = {
  ...base,
  testTimeout: 30000,
  testMatch: ['**/__tests__/**/*.integration.test.ts', '**/*.integration.test.ts'],
  testPathIgnorePatterns: ['/node_modules/']
};
