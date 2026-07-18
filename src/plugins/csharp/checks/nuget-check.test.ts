import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import * as commandRunner from '../../../infra/os/command-runner.js';
import { checkCsharpNuget } from './nuget-check.js';

vi.mock('../../../infra/os/command-runner.js', () => ({
  runCommand: vi.fn(),
}));

vi.mock('node:fs', () => ({
  default: {
    existsSync: vi.fn(),
    accessSync: vi.fn(),
    constants: { R_OK: 4, W_OK: 2 },
  },
}));

describe('csharp-nuget-check', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should warn when dotnet command fails', async () => {
    vi.spyOn(commandRunner, 'runCommand').mockResolvedValue({
      command: 'dotnet',
      args: ['nuget', 'locals', 'global-packages', '--list'],
      stdout: '',
      stderr: 'dotnet command failed',
      exitCode: 1,
      success: false,
      durationMs: 10,
    });

    const result = await checkCsharpNuget();
    expect(result.status).toBe('warn');
    expect(result.message).toBe('Failed to retrieve NuGet global packages cache location.');
  });

  it('should warn when cache path cannot be parsed', async () => {
    vi.spyOn(commandRunner, 'runCommand').mockResolvedValue({
      command: 'dotnet',
      args: ['nuget', 'locals', 'global-packages', '--list'],
      stdout: 'unexpected output',
      stderr: '',
      exitCode: 0,
      success: true,
      durationMs: 10,
    });

    const result = await checkCsharpNuget();
    expect(result.status).toBe('warn');
    expect(result.message).toBe('Could not parse NuGet package cache location from dotnet output.');
  });

  it('should warn when cache directory does not exist', async () => {
    vi.spyOn(commandRunner, 'runCommand').mockResolvedValue({
      command: 'dotnet',
      args: ['nuget', 'locals', 'global-packages', '--list'],
      stdout: 'info : global-packages: /path/to/cache',
      stderr: '',
      exitCode: 0,
      success: true,
      durationMs: 10,
    });
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);

    const result = await checkCsharpNuget();
    expect(result.status).toBe('warn');
    expect(result.message).toBe('NuGet packages cache directory does not exist: "/path/to/cache".');
  });

  it('should fail when cache directory exists but is not accessible', async () => {
    vi.spyOn(commandRunner, 'runCommand').mockResolvedValue({
      command: 'dotnet',
      args: ['nuget', 'locals', 'global-packages', '--list'],
      stdout: 'info : global-packages: /path/to/cache',
      stderr: '',
      exitCode: 0,
      success: true,
      durationMs: 10,
    });
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'accessSync').mockImplementation(() => {
      throw new Error('EACCES');
    });

    const result = await checkCsharpNuget();
    expect(result.status).toBe('fail');
    expect(result.message).toBe(
      'NuGet packages cache directory is not readable/writable: "/path/to/cache".',
    );
  });

  it('should pass when cache directory exists and is accessible', async () => {
    vi.spyOn(commandRunner, 'runCommand').mockResolvedValue({
      command: 'dotnet',
      args: ['nuget', 'locals', 'global-packages', '--list'],
      stdout: 'info : global-packages: /path/to/cache',
      stderr: '',
      exitCode: 0,
      success: true,
      durationMs: 10,
    });
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'accessSync').mockReturnValue(undefined);

    const result = await checkCsharpNuget();
    expect(result.status).toBe('pass');
    expect(result.message).toBe('NuGet packages cache directory is accessible.');
  });
});
