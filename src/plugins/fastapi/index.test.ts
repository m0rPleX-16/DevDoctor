import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as commandRunner from '../../infra/os/command-runner.js';
import { FastapiPlugin } from './index.js';

vi.mock('../../infra/os/command-runner.js', () => ({
  runCommand: vi.fn(),
}));

vi.mock('node:fs', () => ({
  default: {
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    appendFileSync: vi.fn(),
  },
}));

describe('FastapiPlugin Repairs', () => {
  let plugin: FastapiPlugin;

  beforeEach(() => {
    vi.resetAllMocks();
    plugin = new FastapiPlugin();
  });

  it('canRepair should return true for fastapi-venv', () => {
    expect(plugin.canRepair('fastapi-venv')).toBe(true);
    expect(plugin.canRepair('fastapi-uvicorn')).toBe(false);
  });

  it('repair should create python virtual environment', async () => {
    vi.spyOn(commandRunner, 'runCommand').mockResolvedValue({
      command: 'python',
      args: ['-m', 'venv', '.venv'],
      stdout: '',
      stderr: '',
      exitCode: 0,
      success: true,
      durationMs: 10,
    });

    const result = await plugin.repair('fastapi-venv');
    expect(result.success).toBe(true);
    expect(commandRunner.runCommand).toHaveBeenCalledWith('python', ['-m', 'venv', '.venv']);
  });
});
