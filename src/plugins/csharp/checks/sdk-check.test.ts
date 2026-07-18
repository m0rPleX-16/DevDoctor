import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as commandRunner from '../../../infra/os/command-runner.js';
import { checkCsharpSdk } from './sdk-check.js';

vi.mock('../../../infra/os/command-runner.js', () => ({
  runCommand: vi.fn(),
}));

describe('csharp-sdk-check', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should pass when dotnet SDK is installed', async () => {
    vi.spyOn(commandRunner, 'runCommand').mockResolvedValue({
      command: 'dotnet',
      args: ['--version'],
      stdout: '8.0.100\n',
      stderr: '',
      exitCode: 0,
      success: true,
      durationMs: 10,
    });

    const result = await checkCsharpSdk();
    expect(result.status).toBe('pass');
    expect(result.message).toBe('.NET SDK is installed (version 8.0.100).');
  });

  it('should fail when dotnet SDK is not installed', async () => {
    vi.spyOn(commandRunner, 'runCommand').mockResolvedValue({
      command: 'dotnet',
      args: ['--version'],
      stdout: '',
      stderr: 'command not found',
      exitCode: 1,
      success: false,
      durationMs: 10,
    });

    const result = await checkCsharpSdk();
    expect(result.status).toBe('fail');
    expect(result.message).toBe('.NET SDK is not installed or not found on the system PATH.');
  });
});
