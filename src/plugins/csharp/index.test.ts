import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as commandRunner from '../../infra/os/command-runner.js';
import { CsharpPlugin } from './index.js';

vi.mock('../../infra/os/command-runner.js', () => ({
  runCommand: vi.fn(),
}));

describe('CsharpPlugin Repairs', () => {
  let plugin: CsharpPlugin;

  beforeEach(() => {
    vi.resetAllMocks();
    plugin = new CsharpPlugin();
  });

  it('canRepair should return true for csharp-nuget', () => {
    expect(plugin.canRepair('csharp-nuget')).toBe(true);
    expect(plugin.canRepair('csharp-sdk')).toBe(false);
  });

  it('repair should run dotnet restore', async () => {
    vi.spyOn(commandRunner, 'runCommand').mockResolvedValue({
      command: 'dotnet',
      args: ['restore'],
      stdout: '',
      stderr: '',
      exitCode: 0,
      success: true,
      durationMs: 10,
    });

    const result = await plugin.repair('csharp-nuget');
    expect(result.success).toBe(true);
    expect(commandRunner.runCommand).toHaveBeenCalledWith('dotnet', ['restore']);
  });
});
