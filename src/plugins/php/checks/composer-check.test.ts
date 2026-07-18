import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as commandRunner from '../../../infra/os/command-runner.js';
import { checkComposer } from './composer-check.js';

vi.mock('../../../infra/os/command-runner.js', () => ({
  runCommand: vi.fn(),
}));

describe('composer-check', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should pass when Composer is found', async () => {
    vi.spyOn(commandRunner, 'runCommand').mockResolvedValue({
      command: 'composer',
      args: ['--version'],
      success: true,
      stdout: 'Composer version 2.7.2 2024-03-11 17:12:18',
      stderr: '',
      code: 0,
    });

    const check = await checkComposer();
    expect(check.status).toBe('pass');
    expect(check.message).toContain('Composer 2.7.2 is installed.');
  });

  it('should warn when Composer is not found', async () => {
    vi.spyOn(commandRunner, 'runCommand').mockRejectedValue(new Error('command not found'));

    const check = await checkComposer();
    expect(check.status).toBe('warn');
    expect(check.message).toContain('not found');
  });
});
