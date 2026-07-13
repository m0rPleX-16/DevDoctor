import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import * as commandRunner from '../../infra/os/command-runner.js';
import * as installationCheck from './checks/installation-check.js';
import { PythonPlugin } from './index.js';

vi.mock('../../infra/os/command-runner.js', () => ({
  runCommand: vi.fn(),
}));

describe('PythonPlugin Repairs', () => {
  let plugin: PythonPlugin;

  beforeEach(() => {
    vi.resetAllMocks();
    plugin = new PythonPlugin();
  });

  describe('canRepair', () => {
    it('should return true for python-venv', () => {
      expect(plugin.canRepair('python-venv')).toBe(true);
    });

    it('should return false for other checks', () => {
      expect(plugin.canRepair('python-installation')).toBe(false);
      expect(plugin.canRepair('non-existent')).toBe(false);
    });
  });

  describe('repair and rollback', () => {
    it('should successfully run python venv creation', async () => {
      // Mock python installation to return command: 'python3'
      vi.spyOn(installationCheck, 'checkPythonInstallation').mockResolvedValue({
        command: 'python3',
        version: '3.11.0',
        check: {
          name: 'python-installation',
          label: 'Python Installation',
          status: 'pass',
          message: 'Python 3.11.0 is installed.',
        },
      });

      // Mock existsSync to return false for the .venv directory (it doesn't exist yet)
      const existsSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(false);

      // Mock runCommand for python3 -m venv .venv
      vi.spyOn(commandRunner, 'runCommand').mockResolvedValueOnce({
        command: 'python3',
        args: ['-m', 'venv', '.venv'],
        stdout: '',
        stderr: '',
        exitCode: 0,
        success: true,
        durationMs: 10,
      });

      const result = await plugin.repair('python-venv');

      expect(result.success).toBe(true);
      expect(result.rollbackSupported).toBe(true);
      expect(result.message).toContain('Successfully created Python virtual environment');

      existsSpy.mockRestore();
    });

    it('should rollback by removing .venv directory', async () => {
      const venvDir = path.join(process.cwd(), '.venv');
      const existsSpy = vi.spyOn(fs, 'existsSync').mockImplementation((p) => p === venvDir);
      const rmSpy = vi.spyOn(fs, 'rmSync').mockImplementation(() => {});

      const result = await plugin.rollback('python-venv');

      expect(result.success).toBe(true);
      expect(rmSpy).toHaveBeenCalledWith(venvDir, { recursive: true, force: true });

      existsSpy.mockRestore();
      rmSpy.mockRestore();
    });
  });
});
