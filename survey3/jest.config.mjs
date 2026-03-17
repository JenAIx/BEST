/** @type {import('jest').Config} */
export default {
  testEnvironment: 'node',
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/src/$1',
  },
  transform: {
    '.*\\.js$': 'babel-jest',
    '.*\\.mjs$': 'babel-jest',
  },
  transformIgnorePatterns: [
    'node_modules/(?!quasar|@quasar)',
  ],
};
