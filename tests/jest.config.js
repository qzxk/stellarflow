module.exports = {
  // Test environment
  testEnvironment: 'node',
  
  // Test file patterns
  testMatch: [
    '**/tests/**/*.test.js',
    '**/tests/**/*.spec.js',
  ],
  
  // Setup files
  setupFilesAfterEnv: [
    '<rootDir>/tests/setup/test-setup.js',
  ],
  
  // Coverage configuration
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: [
    'text',
    'lcov',
    'html',
    'json-summary',
  ],
  
  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    './examples/05-swarm-apps/rest-api-advanced/src/services/': {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85,
    },
    './examples/05-swarm-apps/rest-api-advanced/src/controllers/': {
      branches: 75,
      functions: 75,
      lines: 75,
      statements: 75,
    },
  },
  
  // Files to collect coverage from
  collectCoverageFrom: [
    'examples/05-swarm-apps/rest-api-advanced/src/**/*.js',
    '!examples/05-swarm-apps/rest-api-advanced/src/utils/logger.js',
    '!examples/05-swarm-apps/rest-api-advanced/src/config/**',
    '!**/*.test.js',
    '!**/*.spec.js',
  ],
  
  // Coverage path ignore patterns
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/tests/',
    '/coverage/',
    'server.js',
  ],
  
  // Test timeout
  testTimeout: 30000,
  
  // Global setup/teardown
  globalSetup: '<rootDir>/tests/setup/global-setup.js',
  globalTeardown: '<rootDir>/tests/setup/global-teardown.js',
  
  // Module paths
  modulePaths: ['<rootDir>'],
  
  // Transform configuration (if using TypeScript or other transpilers)
  transform: {
    '^.+\\.js$': 'babel-jest',
  },
  
  // Clear mocks between tests
  clearMocks: true,
  restoreMocks: true,
  
  // Verbose output
  verbose: true,
  
  // Silent mode (set to false for debugging)
  silent: false,
  
  // Force exit after tests complete
  forceExit: true,
  
  // Detect open handles
  detectOpenHandles: true,
  
  // Maximum worker processes
  maxWorkers: '50%',
  
  // Test categories configuration
  projects: [
    {
      displayName: 'Unit Tests',
      testMatch: ['<rootDir>/tests/unit/**/*.test.js'],
      testTimeout: 10000,
    },
    {
      displayName: 'Integration Tests',
      testMatch: ['<rootDir>/tests/integration/**/*.test.js'],
      testTimeout: 20000,
    },
    {
      displayName: 'Security Tests',
      testMatch: ['<rootDir>/tests/security/**/*.test.js'],
      testTimeout: 15000,
    },
    {
      displayName: 'Performance Tests',
      testMatch: ['<rootDir>/tests/performance/**/*.test.js'],
      testTimeout: 60000,
      maxWorkers: 1, // Run performance tests serially
    },
  ],
  
  // Reporter configuration
  reporters: [
    'default',
    [
      'jest-html-reporters',
      {
        publicPath: './coverage/html-report',
        filename: 'report.html',
        expand: true,
        hideIcon: false,
        pageTitle: 'REST API Test Report',
        logoImgPath: undefined,
        includeFailureMsg: true,
        includeSuiteFailure: true,
      },
    ],
    [
      'jest-junit',
      {
        outputDirectory: './coverage',
        outputName: 'junit.xml',
        ancestorSeparator: ' › ',
        uniqueOutputName: false,
        suiteNameTemplate: '{filepath}',
        classNameTemplate: '{classname}',
        titleTemplate: '{title}',
      },
    ],
  ],
  
  // Watch configuration
  watchman: true,
  watchPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/coverage/',
    '<rootDir>/logs/',
  ],
  
  // Error handling
  bail: false, // Continue running tests after first failure
  
  // Cache configuration
  cache: true,
  cacheDirectory: '<rootDir>/.jest-cache',
  
  // Module file extensions
  moduleFileExtensions: ['js', 'json', 'node'],
  
  // Mock configuration
  automock: false,
  unmockedModulePathPatterns: [
    '<rootDir>/node_modules/',
  ],
  
  // Notification configuration (disable in CI)
  notify: process.env.CI !== 'true',
  notifyMode: 'failure-change',
  
  // Snapshot configuration
  updateSnapshot: process.env.UPDATE_SNAPSHOTS === 'true',
  
  // Custom environment variables for tests
  setupFiles: ['<rootDir>/tests/setup/env-setup.js'],
};