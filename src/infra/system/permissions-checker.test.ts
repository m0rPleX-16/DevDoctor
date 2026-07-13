/**
 * Permissions Checker Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as commandRunner from '../os/command-runner.js';
import fs from 'node:fs';

vi.mock('../os/command-runner.js', () => ({
  runCommand: vi.fn(),
}));

import { checkElevation, checkFileAccess } from './permissions-checker.js';

describe('permissions-checker', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('checkElevation', () => {
    it('reports elevated on Windows when net session succeeds', async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32' });

      vi.spyOn(commandRunner, 'runCommand').mockResolvedValue({
        command: 'net',
        args: ['session'],
        stdout: 'The command completed successfully.',
        stderr: '',
        exitCode: 0,
        success: true,
        durationMs: 10,
      });

      const result = await checkElevation();
      expect(result.isElevated).toBe(true);
      expect(result.method).toBe('net-session');

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('reports not elevated on Windows when net session fails (System error 5)', async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32' });

      vi.spyOn(commandRunner, 'runCommand').mockResolvedValue({
        command: 'net',
        args: ['session'],
        stdout: '',
        stderr: 'System error 5 has occurred. Access is denied.',
        exitCode: 5,
        success: false,
        durationMs: 10,
      });

      const result = await checkElevation();
      expect(result.isElevated).toBe(false);
      expect(result.method).toBe('net-session');

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('reports elevated on Unix when id -u returns 0', async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'linux' });

      vi.spyOn(commandRunner, 'runCommand').mockResolvedValue({
        command: 'id',
        args: ['-u'],
        stdout: '0',
        stderr: '',
        exitCode: 0,
        success: true,
        durationMs: 5,
      });

      const result = await checkElevation();
      expect(result.isElevated).toBe(true);
      expect(result.method).toBe('id');

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('reports not elevated on Unix when id -u returns non-zero UID', async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'linux' });

      vi.spyOn(commandRunner, 'runCommand').mockResolvedValue({
        command: 'id',
        args: ['-u'],
        stdout: '1000',
        stderr: '',
        exitCode: 0,
        success: true,
        durationMs: 5,
      });

      const result = await checkElevation();
      expect(result.isElevated).toBe(false);

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });
  });

  describe('checkFileAccess', () => {
    it('returns readable and writable when both permissions are granted', () => {
      // Inject an accessSync that always succeeds
      const result = checkFileAccess('/some/path', () => undefined);
      expect(result.readable).toBe(true);
      expect(result.writable).toBe(true);
      expect(result.path).toBe('/some/path');
    });

    it('returns readable but not writable when write is denied', () => {
      const result = checkFileAccess('/read-only', (_p, mode) => {
        if (mode === fs.constants.W_OK) throw new Error('EACCES');
      });
      expect(result.readable).toBe(true);
      expect(result.writable).toBe(false);
    });

    it('returns neither readable nor writable when both are denied', () => {
      const result = checkFileAccess('/forbidden', () => {
        throw new Error('EACCES');
      });
      expect(result.readable).toBe(false);
      expect(result.writable).toBe(false);
    });
  });
});
