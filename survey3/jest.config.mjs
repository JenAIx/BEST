/** @type {import('jest').Config} */
export default {
  testEnvironment: 'node',
  testPathIgnorePatterns: [
    '/node_modules/',
    '/test/cypress/',
    // Vue component demo tests require packages not installed
    // (@quasar/quasar-app-extension-testing-unit-jest, @vue/vue3-jest)
    // and App.spec.js uses deprecated Vue 2 API (createLocalVue)
    '/test/jest/__tests__/App\\.spec\\.js$',
    '/test/jest/__tests__/MyButton\\.spec\\.js$',
    '/test/jest/__tests__/MyDialog\\.spec\\.js$',
    // notion module was removed from codebase
    '/test/jest/__tests__/notion_api\\.test\\.js$',
  ],
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/src/$1',
  },
  transform: {
    '.*\\.js$': '<rootDir>/test/jest/viteGlobTransform.cjs',
    '.*\\.mjs$': '<rootDir>/test/jest/viteGlobTransform.cjs',
  },
  transformIgnorePatterns: [
    'node_modules/(?!quasar|@quasar|dateformat|dexie)',
  ],
};
