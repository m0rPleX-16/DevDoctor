import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as commandRunner from '../../../infra/os/command-runner.js';
import { checkPythonInstallation } from './installation-check.js';

vi.mock('../../../infra/os/command-runner.js', () => ({
  runCommand: vi.fn(),
}));

describe('python-installation-check', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should pass for standard 3-digit Python version strings', async () => {
    vi.spyOn(commandRunner, 'runCommand').mockResolvedValue({
      command: 'python3',
      args: ['--version'],
      stdout: 'Python 3.11.4\n',
      stderr: '',
      exitCode: 0,
      success: true,
      durationMs: 10,
    });

    const info = await checkPythonInstallation();
    expect(info.command).toBe('python3');
    expect(info.version).toBe('3.11.4');
    expect(info.check.status).toBe('pass');
    expect(info.check.message).toContain('Python 3.11.4 is installed');
  });

  it('should pass for 2-digit Python version strings (like Python 3.12)', async () => {
    vi.spyOn(commandRunner, 'runCommand').mockResolvedValue({
      command: 'python3',
      args: ['--version'],
      stdout: 'Python 3.12\n',
      stderr: '',
      exitCode: 0,
      success: true,
      durationMs: 10,
    });

    const info = await checkPythonInstallation();
    expect(info.command).toBe('python3');
    expect(info.version).toBe('3.12');
    expect(info.check.status).toBe('pass');
    expect(info.check.message).toContain('Python 3.12 is installed');
  });

  it('should warn and flag end-of-life for Python 2', async () => {
    // If python3 fails but python succeeds with Python 2.7.18
    vi.spyOn(commandRunner, 'runCommand')
      .mockResolvedValueOnce({
        command: 'python3',
        args: ['--version'],
        stdout: '',
        stderr: '',
        exitCode: 1,
        success: false,
        durationMs: 5,
      })
      .mockResolvedValueOnce({
        command: 'python',
        args: ['--version'],
        stdout: 'Python 2.7.18\n',
        stderr: '',
        exitCode: 0,
        success: true,
        durationMs: 10,
      });

    const info = await checkPythonInstallation();
    expect(info.command).toBe('python');
    expect(info.version).toBe('2.7.18');
    expect(info.check.status).toBe('warn');
    expect(info.check.message).toContain('Python 2.7.18 is installed, but Python 2 is end-of-life');
  });

  it('should fail when python command is not found', async () => {
    vi.spyOn(commandRunner, 'runCommand').mockResolvedValue({
      command: 'python3',
      args: ['--version'],
      stdout: '',
      stderr: 'command not found',
      exitCode: 127,
      success: false,
      durationMs: 5,
    });

    const info = await checkPythonInstallation();
    expect(info.command).toBeNull();
    expect(info.version).toBeNull();
    expect(info.check.status).toBe('fail');
  });
});
