import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as commandRunner from '../../../infra/os/command-runner.js';
import { checkFastapiUvicorn } from './uvicorn-check.js';

vi.mock('../../../infra/os/command-runner.js', () => ({
  runCommand: vi.fn(),
}));

describe('fastapi-uvicorn-check', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should pass when uvicorn is installed', async () => {
    vi.spyOn(commandRunner, 'runCommand').mockResolvedValue({
      command: 'python',
      args: ['-m', 'uvicorn', '--version'],
      stdout: 'Running uvicorn 0.22.0 with CPython 3.11.4 on Windows\n',
      stderr: '',
      exitCode: 0,
      success: true,
      durationMs: 10,
    });

    const result = await checkFastapiUvicorn();
    expect(result.status).toBe('pass');
    expect(result.message).toContain('Uvicorn is installed');
  });

  it('should warn when uvicorn is not installed', async () => {
    vi.spyOn(commandRunner, 'runCommand').mockResolvedValue({
      command: 'uvicorn',
      args: ['--version'],
      stdout: '',
      stderr: 'command not found',
      exitCode: 1,
      success: false,
      durationMs: 10,
    });

    const result = await checkFastapiUvicorn();
    expect(result.status).toBe('warn');
    expect(result.message).toBe('Uvicorn ASGI server is not installed or not accessible.');
  });
});
