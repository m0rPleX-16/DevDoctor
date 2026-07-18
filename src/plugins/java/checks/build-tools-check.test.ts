import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import * as commandRunner from '../../../infra/os/command-runner.js';
import { checkJavaBuildTools } from './build-tools-check.js';

vi.mock('../../../infra/os/command-runner.js', () => ({
  runCommand: vi.fn(),
}));

vi.mock('node:fs', () => ({
  default: {
    existsSync: vi.fn(),
  },
}));

describe('java-build-tools-check', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should pass if no build files are found', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);

    const result = await checkJavaBuildTools();
    expect(result.status).toBe('pass');
    expect(result.message).toContain('No Java build configuration files');
  });

  it('should pass if maven wrapper exists', async () => {
    vi.spyOn(fs, 'existsSync').mockImplementation((path: any) => {
      if (path.includes('pom.xml')) return true;
      if (path.includes('mvnw')) return true;
      return false;
    });

    const result = await checkJavaBuildTools();
    expect(result.status).toBe('pass');
    expect(result.message).toBe('Build tools (Maven/Gradle) are configured correctly.');
  });

  it('should pass if gradle wrapper exists', async () => {
    vi.spyOn(fs, 'existsSync').mockImplementation((path: any) => {
      if (path.includes('build.gradle')) return true;
      if (path.includes('gradlew')) return true;
      return false;
    });

    const result = await checkJavaBuildTools();
    expect(result.status).toBe('pass');
  });

  it('should warn if pom.xml exists but no wrapper and no global mvn', async () => {
    vi.spyOn(fs, 'existsSync').mockImplementation((path: any) => path.includes('pom.xml'));
    vi.spyOn(commandRunner, 'runCommand').mockResolvedValue({
      command: 'mvn',
      args: [],
      stdout: '',
      stderr: 'not found',
      exitCode: 1,
      success: false,
      durationMs: 10,
    });

    const result = await checkJavaBuildTools();
    expect(result.status).toBe('warn');
    expect(result.detail).toContain('neither local wrapper (mvnw) nor global `mvn`');
  });
});
