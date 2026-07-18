import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import * as commandRunner from '../../../infra/os/command-runner.js';
import { checkCppBuildGenerator } from './build-generator-check.js';

vi.mock('../../../infra/os/command-runner.js', () => ({
  runCommand: vi.fn(),
}));

vi.mock('node:fs', () => ({
  default: {
    existsSync: vi.fn(),
  },
}));

describe('cpp-build-generator-check', () => {
  const originalPlatform = process.platform;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should pass when CMakeLists.txt exists and cmake is found', async () => {
    vi.spyOn(fs, 'existsSync').mockImplementation((path: any) => path.includes('CMakeLists.txt'));
    vi.spyOn(commandRunner, 'runCommand').mockResolvedValue({
      command: 'cmake',
      args: [],
      stdout: 'cmake version 3.22.1',
      stderr: '',
      exitCode: 0,
      success: true,
      durationMs: 10,
    });

    const result = await checkCppBuildGenerator();
    expect(result.status).toBe('pass');
    expect(result.message).toContain('CMake (cmake version 3.22.1)');
  });

  it('should warn when CMakeLists.txt exists but cmake is not found', async () => {
    vi.spyOn(fs, 'existsSync').mockImplementation((path: any) => path.includes('CMakeLists.txt'));
    vi.spyOn(commandRunner, 'runCommand').mockResolvedValue({
      command: 'cmake',
      args: [],
      stdout: '',
      stderr: 'command not found',
      exitCode: 1,
      success: false,
      durationMs: 10,
    });

    const result = await checkCppBuildGenerator();
    expect(result.status).toBe('warn');
    expect(result.message).toBe('Required build tool(s) missing: cmake');
  });

  it('should pass when Makefile exists and make is found', async () => {
    vi.spyOn(fs, 'existsSync').mockImplementation((path: any) => path.includes('Makefile'));
    vi.spyOn(commandRunner, 'runCommand').mockResolvedValue({
      command: 'make',
      args: [],
      stdout: 'GNU Make 4.3',
      stderr: '',
      exitCode: 0,
      success: true,
      durationMs: 10,
    });

    const result = await checkCppBuildGenerator();
    expect(result.status).toBe('pass');
    expect(result.message).toContain('Make (GNU Make 4.3)');
  });

  it('should fallback to mingw32-make on windows if make fails', async () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });
    vi.spyOn(fs, 'existsSync').mockImplementation((path: any) => path.includes('Makefile'));
    vi.spyOn(commandRunner, 'runCommand').mockImplementation(async (command) => {
      if (command === 'mingw32-make') {
        return {
          command,
          args: [],
          stdout: 'mingw32-make 4.2.1',
          stderr: '',
          exitCode: 0,
          success: true,
          durationMs: 10,
        };
      }
      return {
        command,
        args: [],
        stdout: '',
        stderr: '',
        exitCode: 1,
        success: false,
        durationMs: 10,
      };
    });

    const result = await checkCppBuildGenerator();
    Object.defineProperty(process, 'platform', { value: originalPlatform });

    expect(result.status).toBe('pass');
    expect(result.message).toContain('Make (mingw32-make 4.2.1)');
  });

  it('should pass if no build files exist but ninja is found', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);
    vi.spyOn(commandRunner, 'runCommand').mockImplementation(async (command) => {
      if (command === 'ninja') {
        return {
          command,
          args: [],
          stdout: '1.10.1',
          stderr: '',
          exitCode: 0,
          success: true,
          durationMs: 10,
        };
      }
      return {
        command,
        args: [],
        stdout: '',
        stderr: '',
        exitCode: 1,
        success: false,
        durationMs: 10,
      };
    });

    const result = await checkCppBuildGenerator();
    expect(result.status).toBe('pass');
    expect(result.message).toBe('C++ build generator(s) verified: ninja.');
  });

  it('should warn if no build files exist and no generators are found', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);
    vi.spyOn(commandRunner, 'runCommand').mockResolvedValue({
      command: 'any',
      args: [],
      stdout: '',
      stderr: 'not found',
      exitCode: 1,
      success: false,
      durationMs: 10,
    });

    const result = await checkCppBuildGenerator();
    expect(result.status).toBe('warn');
    expect(result.message).toBe(
      'No common C++ build generators (cmake, make, ninja) found on PATH.',
    );
  });
});
