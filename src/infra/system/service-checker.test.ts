import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkService } from './service-checker.js';
import * as commandRunner from '../os/command-runner.js';

vi.mock('../os/command-runner.js', () => ({
  runCommand: vi.fn(),
}));

describe('service-checker', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should parse a running Windows service status correctly', async () => {
    // Force win32 platform for test execution context if needed
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'win32' });

    vi.spyOn(commandRunner, 'runCommand').mockResolvedValue({
      command: 'sc',
      args: ['query', 'MySQL80'],
      stdout: `
SERVICE_NAME: MySQL80
        TYPE               : 10  WIN32_OWN_PROCESS
        STATE              : 4  RUNNING
                                (STOPPABLE, PAUSABLE, ACCEPTS_SHUTDOWN)
        WIN32_EXIT_CODE    : 0  (0x0)
        SERVICE_EXIT_CODE  : 0  (0x0)
        CHECKPOINT         : 0x0
        WAIT_HINT          : 0x0
        PID                : 1234
        FLAGS              :
      `,
      stderr: '',
      exitCode: 0,
      success: true,
      durationMs: 5,
    });

    const info = await checkService('MySQL80');

    expect(info.status).toBe('running');
    expect(info.pid).toBe(1234);

    // Restore platform
    Object.defineProperty(process, 'platform', { value: originalPlatform });
  });

  it('should parse a stopped Windows service status correctly', async () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'win32' });

    vi.spyOn(commandRunner, 'runCommand').mockResolvedValue({
      command: 'sc',
      args: ['query', 'MySQL80'],
      stdout: `
SERVICE_NAME: MySQL80
        TYPE               : 10  WIN32_OWN_PROCESS
        STATE              : 1  STOPPED
        WIN32_EXIT_CODE    : 1077  (0x435)
        SERVICE_EXIT_CODE  : 0  (0x0)
        CHECKPOINT         : 0x0
        WAIT_HINT          : 0x0
        PID                : 0
        FLAGS              :
      `,
      stderr: '',
      exitCode: 0,
      success: true,
      durationMs: 5,
    });

    const info = await checkService('MySQL80');

    expect(info.status).toBe('stopped');
    expect(info.pid).toBe(0);

    Object.defineProperty(process, 'platform', { value: originalPlatform });
  });

  it('should handle Windows service not installed error code', async () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'win32' });

    vi.spyOn(commandRunner, 'runCommand').mockResolvedValue({
      command: 'sc',
      args: ['query', 'MySQL80'],
      stdout: '',
      stderr:
        '[SC] EnumQueryServicesStatus:An error occurred (1060): The specified service does not exist as an installed service.',
      exitCode: 1,
      success: false,
      durationMs: 5,
    });

    const info = await checkService('MySQL80');

    expect(info.status).toBe('not_installed');

    Object.defineProperty(process, 'platform', { value: originalPlatform });
  });
});
