/**
 * Process Manager Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as commandRunner from './command-runner.js';

vi.mock('./command-runner.js', () => ({ runCommand: vi.fn() }));

import { findRunningProcess } from './process-manager.js';

describe('process-manager', () => {
  beforeEach(() => vi.resetAllMocks());

  describe('findRunningProcess (Windows)', () => {
    it('detects a running process from tasklist CSV output', async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32' });

      vi.spyOn(commandRunner, 'runCommand').mockResolvedValue({
        command: 'tasklist',
        args: [],
        stdout: '"mysqld.exe","1234","Services","0","45,212 K"',
        stderr: '',
        exitCode: 0,
        success: true,
        durationMs: 5,
      });

      const result = await findRunningProcess('mysqld.exe');
      expect(result.running).toBe(true);
      expect(result.pids).toContain(1234);

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('returns not running when tasklist reports No tasks', async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32' });

      vi.spyOn(commandRunner, 'runCommand').mockResolvedValue({
        command: 'tasklist',
        args: [],
        stdout: 'No tasks are running which match the specified criteria.',
        stderr: '',
        exitCode: 0,
        success: true,
        durationMs: 5,
      });

      const result = await findRunningProcess('mysqld.exe');
      expect(result.running).toBe(false);
      expect(result.pids).toHaveLength(0);

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('returns not running when command fails', async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32' });

      vi.spyOn(commandRunner, 'runCommand').mockResolvedValue({
        command: 'tasklist',
        args: [],
        stdout: '',
        stderr: 'Access denied',
        exitCode: 1,
        success: false,
        durationMs: 5,
      });

      const result = await findRunningProcess('mysqld.exe');
      expect(result.running).toBe(false);

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });
  });

  describe('findRunningProcess (Unix)', () => {
    it('detects a running process from pgrep output', async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'linux' });

      vi.spyOn(commandRunner, 'runCommand').mockResolvedValue({
        command: 'pgrep',
        args: ['-x', 'mysqld'],
        stdout: '5678\n9012',
        stderr: '',
        exitCode: 0,
        success: true,
        durationMs: 5,
      });

      const result = await findRunningProcess('mysqld');
      expect(result.running).toBe(true);
      expect(result.pids).toEqual([5678, 9012]);

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('returns not running when pgrep finds nothing', async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'linux' });

      vi.spyOn(commandRunner, 'runCommand').mockResolvedValue({
        command: 'pgrep',
        args: ['-x', 'mysqld'],
        stdout: '',
        stderr: '',
        exitCode: 1,
        success: false,
        durationMs: 5,
      });

      const result = await findRunningProcess('mysqld');
      expect(result.running).toBe(false);

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });
  });
});
