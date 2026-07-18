import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as commandRunner from '../../../infra/os/command-runner.js';
import { checkJavaInstallation } from './installation-check.js';

vi.mock('../../../infra/os/command-runner.js', () => ({
  runCommand: vi.fn(),
}));

describe('java-installation-check', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should pass when java is installed', async () => {
    vi.spyOn(commandRunner, 'runCommand').mockResolvedValue({
      command: 'java',
      args: ['-version'],
      stdout: '',
      stderr: 'openjdk version "17.0.8" 2023-07-18\nOpenJDK Runtime Environment',
      exitCode: 0,
      success: true,
      durationMs: 10,
    });

    const result = await checkJavaInstallation();
    expect(result.status).toBe('pass');
    expect(result.message).toContain('Java is installed (version 17.0.8).');
  });

  it('should fail when java is not installed', async () => {
    vi.spyOn(commandRunner, 'runCommand').mockResolvedValue({
      command: 'java',
      args: ['-version'],
      stdout: '',
      stderr: 'command not found',
      exitCode: 1,
      success: false,
      durationMs: 10,
    });

    const result = await checkJavaInstallation();
    expect(result.status).toBe('fail');
    expect(result.message).toBe('Java is not installed or not found on the system PATH.');
  });
});
