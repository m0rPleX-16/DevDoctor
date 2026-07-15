import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { scanEnvironment, parsePath } from './env-scanner.js';
import fs from 'node:fs';

vi.mock('node:fs', () => ({
  default: {
    statSync: vi.fn(),
  },
}));

describe('env-scanner', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.resetAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('parsePath', () => {
    it('should split paths correctly and validate directory existence', () => {
      const isWindows = process.platform === 'win32';
      const pathValue = isWindows
        ? 'C:\\bin;C:\\Windows;D:\\nonexistent'
        : '/usr/bin:/bin:/nonexistent';

      // Mock fs.statSync to return directory or throw error
      vi.spyOn(fs, 'statSync').mockImplementation((p) => {
        if (p.toString().includes('nonexistent')) {
          throw new Error('Not found');
        }
        return { isDirectory: () => true } as fs.Stats;
      });

      const entries = parsePath(pathValue);

      expect(entries).toHaveLength(3);
      expect(entries[0].exists).toBe(true);
      expect(entries[1].exists).toBe(true);
      expect(entries[2].exists).toBe(false);
    });
  });

  describe('scanEnvironment', () => {
    it('should capture and categorize known environment variables', () => {
      process.env.NODE_ENV = 'development';
      process.env.JAVA_HOME = 'C:\\Java\\jdk';

      const info = scanEnvironment(false);

      const nodeEnv = info.variables.find((v) => v.name === 'NODE_ENV');
      expect(nodeEnv).toBeDefined();
      expect(nodeEnv?.value).toBe('development');
      expect(nodeEnv?.category).toBe('node');

      const javaHome = info.variables.find((v) => v.name === 'JAVA_HOME');
      expect(javaHome).toBeDefined();
      expect(javaHome?.value).toBe('C:\\Java\\jdk');
      expect(javaHome?.category).toBe('java');
    });

    it('should capture all environment variables if includeAll is true', () => {
      process.env.CUSTOM_DEV_VAR = 'xyz';

      const info = scanEnvironment(true);

      const customVar = info.variables.find((v) => v.name === 'CUSTOM_DEV_VAR');
      expect(customVar).toBeDefined();
      expect(customVar?.value).toBe('xyz');
      expect(customVar?.category).toBe('other');
    });
  });
});
