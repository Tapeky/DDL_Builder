import config from './jest.config.mjs';

export default {
  ...config,
  testMatch: ['<rootDir>/test/**/*.integration.ts'],
  testTimeout: 30000,
};
