/** @type {import('jest').Config} */
const config = {
  // 测试环境
  testEnvironment: 'jsdom',
  
  // 根目录
  rootDir: '../',
  
  // 测试文件匹配模式
  testMatch: [
    '<rootDir>/tests/unit/frontend/**/*.{test,spec}.{js,jsx,ts,tsx}',
    '<rootDir>/src/**/*.{test,spec}.{js,jsx,ts,tsx}'
  ],
  
  // 模块路径映射 (与 vite.config.ts 保持一致)
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@/components/(.*)$': '<rootDir>/src/components/$1',
    '^@/pages/(.*)$': '<rootDir>/src/pages/$1',
    '^@/hooks/(.*)$': '<rootDir>/src/hooks/$1',
    '^@/utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@/types/(.*)$': '<rootDir>/src/types/$1',
    '^@/services/(.*)$': '<rootDir>/src/services/$1',
    '^@/store/(.*)$': '<rootDir>/src/store/$1',
    '^@/themes/(.*)$': '<rootDir>/src/themes/$1',
    // 静态资源模拟
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(gif|ttf|eot|svg|png)$': '<rootDir>/test-config/__mocks__/fileMock.js',
  },
  
  // 文件扩展名
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  
  // 转换配置
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
    }],
  },
  
  // 设置文件
  setupFilesAfterEnv: ['<rootDir>/test-config/jest.setup.js'],
  
  // 覆盖率配置
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/main.tsx',
    '!src/vite-env.d.ts',
    '!src/**/*.stories.{ts,tsx}',
  ],
  coverageDirectory: '<rootDir>/test-reports/coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 85,
      lines: 85,
      statements: 85,
    },
  },
  
  // 忽略的文件
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/dist/',
    '<rootDir>/tests/e2e/',
    '<rootDir>/tests/integration/',
  ],
  
  // 模块忽略模式
  transformIgnorePatterns: [
    'node_modules/(?!(.*\\.mjs$|@testing-library|@mui))',
  ],
  
  // 清理 mock
  clearMocks: true,
  restoreMocks: true,
  
  // 报告配置
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: '<rootDir>/test-reports/junit',
      outputName: 'frontend-unit-tests.xml',
    }],
  ],
  
  // 全局配置
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.json',
    },
  },
  
  
  // 测试超时
  testTimeout: 10000,
};

module.exports = config;