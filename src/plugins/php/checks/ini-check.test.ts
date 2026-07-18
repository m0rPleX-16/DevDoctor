import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import * as commandRunner from '../../../infra/os/command-runner.js';
import { checkPhpIni } from './ini-check.js';

vi.mock('../../../infra/os/command-runner.js', () => ({
  runCommand: vi.fn(),
}));

vi.mock('node:fs', () => ({
  default: {
    existsSync: vi.fn(),
  },
}));

describe('php-ini-check', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should pass when active php.ini exists', async () => {
    vi.spyOn(commandRunner, 'runCommand').mockResolvedValue({
      command: 'php',
      args: ['-r', 'echo php_ini_loaded_file();'],
      success: true,
      stdout: '/etc/php/8.2/cli/php.ini',
      stderr: '',
      code: 0,
    });
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);

    const check = await checkPhpIni();
    expect(check.status).toBe('pass');
    expect(check.message).toContain('/etc/php/8.2/cli/php.ini');
  });

  it('should warn when loaded php.ini does not exist', async () => {
    vi.spyOn(commandRunner, 'runCommand').mockResolvedValue({
      command: 'php',
      args: ['-r', 'echo php_ini_loaded_file();'],
      success: true,
      stdout: '',
      stderr: '',
      code: 0,
    });

    const check = await checkPhpIni();
    expect(check.status).toBe('warn');
    expect(check.message).toContain('not found');
  });

  it('should warn when command execution fails', async () => {
    vi.spyOn(commandRunner, 'runCommand').mockRejectedValue(new Error('failed'));

    const check = await checkPhpIni();
    expect(check.status).toBe('warn');
    expect(check.message).toContain('not found');
  });
});
