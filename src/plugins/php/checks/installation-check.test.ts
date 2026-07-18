import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as commandRunner from '../../../infra/os/command-runner.js';
import { checkPhpInstallation } from './installation-check.js';

vi.mock('../../../infra/os/command-runner.js', () => ({
  runCommand: vi.fn(),
}));

describe('php-installation-check', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should pass when modern PHP is installed', async () => {
    vi.spyOn(commandRunner, 'runCommand').mockResolvedValue({
      command: 'php',
      args: ['-v'],
      success: true,
      stdout: 'PHP 8.2.12 (cli) (built: Oct 24 2023 21:15:15) (NTS)',
      stderr: '',
      code: 0,
    });

    const info = await checkPhpInstallation();
    expect(info.version).toBe('8.2.12');
    expect(info.check.status).toBe('pass');
    expect(info.check.message).toContain('PHP 8.2.12 is installed.');
  });

  it('should warn when outdated PHP is installed', async () => {
    vi.spyOn(commandRunner, 'runCommand').mockResolvedValue({
      command: 'php',
      args: ['-v'],
      success: true,
      stdout: 'PHP 7.4.33 (cli) (built: Nov  2 2022 16:00:00) (NTS)',
      stderr: '',
      code: 0,
    });

    const info = await checkPhpInstallation();
    expect(info.version).toBe('7.4.33');
    expect(info.check.status).toBe('warn');
    expect(info.check.message).toContain('highly recommended');
  });

  it('should fail when PHP is not found', async () => {
    vi.spyOn(commandRunner, 'runCommand').mockRejectedValue(new Error('command not found'));

    const info = await checkPhpInstallation();
    expect(info.version).toBeNull();
    expect(info.check.status).toBe('fail');
    expect(info.check.message).toContain('not installed');
  });
});
