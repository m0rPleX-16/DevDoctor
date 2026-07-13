/**
 * XAMPP Process Check Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as commandRunner from '../../../infra/os/command-runner.js';

vi.mock('../../../infra/os/command-runner.js', () => ({ runCommand: vi.fn() }));

import { checkXamppProcess, resolveMysqldPath } from './xampp-process-check.js';

// ── Helpers ───────────────────────────────────────────────────────

/** Builds a tasklist mock result simulating a running mysqld.exe */
function tasklistRunning(pid = 1234) {
  return {
    command: 'tasklist', args: [],
    stdout: `"mysqld.exe","${pid}","Services","0","45,212 K"`,
    stderr: '', exitCode: 0, success: true, durationMs: 5,
  };
}

/** Builds a tasklist mock result simulating no process found */
const tasklistEmpty = {
  command: 'tasklist', args: [],
  stdout: 'No tasks are running which match the specified criteria.',
  stderr: '', exitCode: 0, success: true, durationMs: 5,
};

describe('xampp-process-check', () => {
  beforeEach(() => vi.resetAllMocks());

  // ── resolveMysqldPath ──────────────────────────────────────────

  describe('resolveMysqldPath', () => {
    it('returns the XAMPP fallback path when it exists', async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32' });

      // Only the XAMPP fallback path exists; no config files
      const existsSync = (p: string) => p === 'C:\\xampp\\mysql\\bin\\mysqld.exe';

      const result = await resolveMysqldPath(existsSync);
      expect(result).toBe('C:\\xampp\\mysql\\bin\\mysqld.exe');

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('returns undefined when no binary path exists', async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32' });

      const existsSync = () => false;
      const result = await resolveMysqldPath(existsSync);
      expect(result).toBeUndefined();

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });
  });

  // ── checkXamppProcess ──────────────────────────────────────────

  describe('checkXamppProcess', () => {
    it('returns pass when mysqld is already running', async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32' });

      vi.spyOn(commandRunner, 'runCommand').mockResolvedValue(tasklistRunning(1234));

      const result = await checkXamppProcess(() => false);
      expect(result.check.status).toBe('pass');
      expect(result.check.message).toContain('1234');
      expect(result.runningPids).toContain(1234);

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('returns fail when mysqld is not running but binary exists at XAMPP path', async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32' });

      vi.spyOn(commandRunner, 'runCommand').mockResolvedValue(tasklistEmpty);

      // Only the XAMPP mysqld.exe path exists
      const existsSync = (p: string) => p === 'C:\\xampp\\mysql\\bin\\mysqld.exe';

      const result = await checkXamppProcess(existsSync);
      expect(result.check.status).toBe('fail');
      expect(result.mysqldPath).toBe('C:\\xampp\\mysql\\bin\\mysqld.exe');
      expect(result.runningPids).toHaveLength(0);
      expect(result.check.message).toContain('C:\\xampp\\mysql\\bin\\mysqld.exe');

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('returns warn when mysqld is not running and binary not found', async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32' });

      vi.spyOn(commandRunner, 'runCommand').mockResolvedValue(tasklistEmpty);

      const result = await checkXamppProcess(() => false);
      expect(result.check.status).toBe('warn');
      expect(result.mysqldPath).toBeUndefined();
      expect(result.check.message).toContain('could not be located');

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('includes a suggestion pointing to the XAMPP Control Panel when binary not found', async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32' });

      vi.spyOn(commandRunner, 'runCommand').mockResolvedValue(tasklistEmpty);

      const result = await checkXamppProcess(() => false);
      expect(result.check.suggestion).toContain('XAMPP Control Panel');

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('includes devdoctor fix suggestion when binary is found', async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32' });

      vi.spyOn(commandRunner, 'runCommand').mockResolvedValue(tasklistEmpty);
      const existsSync = (p: string) => p === 'C:\\xampp\\mysql\\bin\\mysqld.exe';

      const result = await checkXamppProcess(existsSync);
      expect(result.check.suggestion).toContain('devdoctor fix mysql');

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });
  });
});
