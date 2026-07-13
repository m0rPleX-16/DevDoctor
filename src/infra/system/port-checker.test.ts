import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getPortOwner } from './port-checker.js';
import * as commandRunner from '../os/command-runner.js';

vi.mock('../os/command-runner.js', () => ({
  runCommand: vi.fn(),
}));

describe('port-checker', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should resolve process owning a port on Windows', async () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'win32' });

    vi.spyOn(commandRunner, 'runCommand').mockImplementation(async (command, args) => {
      if (command === 'netstat') {
        return {
          command,
          args: args || [],
          stdout: `
  Active Connections

    Proto  Local Address          Foreign Address        State           PID
    TCP    0.0.0.0:135            0.0.0.0:0              LISTENING       844
    TCP    0.0.0.0:3306           0.0.0.0:0              LISTENING       5678
    TCP    [::]:3306              [::]:0                 LISTENING       5678
          `,
          stderr: '',
          exitCode: 0,
          success: true,
          durationMs: 5,
        };
      }
      if (command === 'tasklist') {
        return {
          command,
          args: args || [],
          stdout: `mysqld.exe                   5678 Services                   0     45,212 K`,
          stderr: '',
          exitCode: 0,
          success: true,
          durationMs: 5,
        };
      }
      return {
        command,
        args: args || [],
        stdout: '',
        stderr: '',
        exitCode: 0,
        success: true,
        durationMs: 5,
      };
    });

    const owner = await getPortOwner(3306);

    expect(owner).not.toBeNull();
    expect(owner?.pid).toBe(5678);
    expect(owner?.processName).toBe('mysqld.exe');

    Object.defineProperty(process, 'platform', { value: originalPlatform });
  });

  it('should return null if no process owns the port', async () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'win32' });

    vi.spyOn(commandRunner, 'runCommand').mockResolvedValue({
      command: 'netstat',
      args: ['-ano', '-p', 'tcp'],
      stdout: 'Proto  Local Address          Foreign Address        State           PID',
      stderr: '',
      exitCode: 0,
      success: true,
      durationMs: 5,
    });

    const owner = await getPortOwner(3306);
    expect(owner).toBeNull();

    Object.defineProperty(process, 'platform', { value: originalPlatform });
  });
});
