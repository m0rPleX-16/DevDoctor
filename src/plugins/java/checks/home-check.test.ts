import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import { checkJavaHome } from './home-check.js';

vi.mock('node:fs', () => ({
  default: {
    existsSync: vi.fn(),
  },
}));

describe('java-home-check', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('should warn when JAVA_HOME is not set', async () => {
    vi.stubEnv('JAVA_HOME', '');
    const result = await checkJavaHome();
    expect(result.status).toBe('warn');
    expect(result.message).toBe('JAVA_HOME environment variable is not defined.');
  });

  it('should fail when JAVA_HOME points to non-existent directory', async () => {
    vi.stubEnv('JAVA_HOME', '/fake/path');
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);

    const result = await checkJavaHome();
    expect(result.status).toBe('fail');
    expect(result.message).toContain('JAVA_HOME is defined but points to a non-existent directory');
  });

  it('should warn when java binary is not inside JAVA_HOME', async () => {
    vi.stubEnv('JAVA_HOME', '/real/path');
    vi.spyOn(fs, 'existsSync').mockImplementation((path: any) => {
      if (path === '/real/path') return true;
      return false; // bin/java does not exist
    });

    const result = await checkJavaHome();
    expect(result.status).toBe('warn');
    expect(result.message).toContain('but bin/java was not found.');
  });

  it('should pass when JAVA_HOME is valid and contains java binary', async () => {
    vi.stubEnv('JAVA_HOME', '/real/path');
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);

    const result = await checkJavaHome();
    expect(result.status).toBe('pass');
    expect(result.message).toContain('is valid');
  });
});
