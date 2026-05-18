import type { Config } from 'jest';

const swcTransform: [string, Record<string, unknown>] = [
  '@swc/jest',
  {
    jsc: {
      parser: { syntax: 'typescript', decorators: true },
      transform: { legacyDecorator: true, decoratorMetadata: true },
      target: 'es2023',
    },
    module: { type: 'commonjs' },
  },
];

const config: Config = {
  projects: [
    {
      displayName: 'unit',
      testMatch: ['<rootDir>/tests/unit/**/*.spec.ts'],
      moduleFileExtensions: ['js', 'json', 'ts'],
      transform: { '^.+\\.ts$': swcTransform },
      moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1',
        '^@spoonfeed/(.*)$': '<rootDir>/src/$1',
      },
      testEnvironment: 'node',
    },
    {
      displayName: 'integration',
      testMatch: ['<rootDir>/tests/integration/**/*.spec.ts'],
      moduleFileExtensions: ['js', 'json', 'ts'],
      transform: { '^.+\\.ts$': swcTransform },
      moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1',
        '^@spoonfeed/(.*)$': '<rootDir>/src/$1',
      },
      testEnvironment: 'node',
      testTimeout: 30000,
    },
    {
      displayName: 'e2e',
      testMatch: ['<rootDir>/tests/e2e/**/*.spec.ts'],
      moduleFileExtensions: ['js', 'json', 'ts'],
      transform: { '^.+\\.ts$': swcTransform },
      moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1',
        '^@spoonfeed/(.*)$': '<rootDir>/src/$1',
      },
      testEnvironment: 'node',
      testTimeout: 120000,
    },
  ],
};

export default config;
