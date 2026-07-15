import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import * as commandRunner from '../../infra/os/command-runner.js';
import { NodePlugin } from './index.js';

vi.mock('../../infra/os/command-runner.js', () => ({
  runCommand: vi.fn(),
}));

describe('NodePlugin Repairs', () => {
  let plugin: NodePlugin;

  beforeEach(() => {
    vi.resetAllMocks();
    plugin = new NodePlugin();
  });

  describe('canRepair', () => {
    it('should return true for node-permissions', () => {
      expect(plugin.canRepair('node-permissions')).toBe(true);
    });

    it('should return false for other checks', () => {
      expect(plugin.canRepair('node-version')).toBe(false);
      expect(plugin.canRepair('non-existent')).toBe(false);
    });
  });

  describe('repair and rollback', () => {
    it('should successfully set new prefix and allow rollback', async () => {
      // Mock npm config get prefix
      vi.spyOn(commandRunner, 'runCommand')
        .mockResolvedValueOnce({
          command: 'npm',
          args: ['config', 'get', 'prefix'],
          stdout: '/usr/local',
          stderr: '',
          exitCode: 0,
          success: true,
          durationMs: 1,
        })
        // Mock npm config set prefix
        .mockResolvedValueOnce({
          command: 'npm',
          args: ['config', 'set', 'prefix', 'dummy-path'],
          stdout: '',
          stderr: '',
          exitCode: 0,
          success: true,
          durationMs: 1,
        });

      // Ensure nvm is not detected (so the guard doesn't block the repair),
      // but allow all other existsSync calls to proceed normally.
      const nvmDir = path.join(os.homedir(), '.nvm');
      const existsSpy = vi.spyOn(fs, 'existsSync').mockImplementation((p) => {
        if (p === nvmDir) return false; // no nvm
        if (typeof p === 'string' && p.includes('nvm')) return false; // no nvm-windows
        return true; // devdoctor dir + target prefix exist
      });
      const writeSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
      const mkdirSpy = vi.spyOn(fs, 'mkdirSync').mockImplementation(() => ({}) as any);

      // Also clear NVM_DIR / NVM_HOME from env for the duration of this test
      const savedNvmDir = process.env.NVM_DIR;
      const savedNvmHome = process.env.NVM_HOME;
      delete process.env.NVM_DIR;
      delete process.env.NVM_HOME;

      const result = await plugin.repair('node-permissions');

      // Restore env
      if (savedNvmDir !== undefined) process.env.NVM_DIR = savedNvmDir;
      if (savedNvmHome !== undefined) process.env.NVM_HOME = savedNvmHome;

      expect(result.success).toBe(true);
      expect(result.rollbackSupported).toBe(true);
      expect(writeSpy).toHaveBeenCalledWith(
        expect.stringContaining('npm-rollback-prefix.txt'),
        '/usr/local',
        'utf-8',
      );

      writeSpy.mockRestore();
      existsSpy.mockRestore();
      mkdirSpy.mockRestore();
    });

    it('should rollback to saved prefix if rollback file exists', async () => {
      const rollbackFile = path.join(os.homedir(), '.devdoctor', 'npm-rollback-prefix.txt');

      const existsSpy = vi.spyOn(fs, 'existsSync').mockImplementation((p) => p === rollbackFile);
      const readSpy = vi.spyOn(fs, 'readFileSync').mockReturnValue('/usr/local');
      const unlinkSpy = vi.spyOn(fs, 'unlinkSync').mockImplementation(() => {});

      vi.spyOn(commandRunner, 'runCommand').mockResolvedValueOnce({
        command: 'npm',
        args: ['config', 'set', 'prefix', '/usr/local'],
        stdout: '',
        stderr: '',
        exitCode: 0,
        success: true,
        durationMs: 1,
      });

      const result = await plugin.rollback('node-permissions');

      expect(result.success).toBe(true);
      expect(unlinkSpy).toHaveBeenCalledWith(rollbackFile);

      existsSpy.mockRestore();
      readSpy.mockRestore();
      unlinkSpy.mockRestore();
    });
  });
});
