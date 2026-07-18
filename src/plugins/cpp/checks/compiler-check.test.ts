import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as commandRunner from '../../../infra/os/command-runner.js';
import { checkCppCompiler } from './compiler-check.js';

vi.mock('../../../infra/os/command-runner.js', () => ({
  runCommand: vi.fn(),
}));

describe('cpp-compiler-check', () => {
  const originalPlatform = process.platform;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should pass when g++ is installed', async () => {
    vi.spyOn(commandRunner, 'runCommand').mockImplementation(async (command) => {
      if (command === 'g++') {
        return {
          command: 'g++',
          args: [],
          stdout: 'g++ (GCC) 11.4.0\n',
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

    const result = await checkCppCompiler();
    expect(result.status).toBe('pass');
    expect(result.message).toBe('GCC C++ compiler detected: g++ (GCC) 11.4.0');
  });

  it('should pass when clang++ is installed', async () => {
    vi.spyOn(commandRunner, 'runCommand').mockImplementation(async (command) => {
      if (command === 'clang++') {
        return {
          command: 'clang++',
          args: [],
          stdout: 'clang version 14.0.0\n',
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

    const result = await checkCppCompiler();
    expect(result.status).toBe('pass');
    expect(result.message).toBe('Clang C++ compiler detected: clang version 14.0.0');
  });

  it('should pass when cl.exe (MSVC) is installed on Windows', async () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });
    vi.spyOn(commandRunner, 'runCommand').mockImplementation(async (command) => {
      if (command === 'cl') {
        return {
          command: 'cl',
          args: [],
          stdout: '',
          stderr: 'Microsoft (R) C/C++ Optimizing Compiler Version 19.30',
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

    const result = await checkCppCompiler();
    Object.defineProperty(process, 'platform', { value: originalPlatform });

    expect(result.status).toBe('pass');
    expect(result.message).toContain('MSVC C++ compiler detected');
  });

  it('should warn when no compiler is found', async () => {
    vi.spyOn(commandRunner, 'runCommand').mockResolvedValue({
      command: 'any',
      args: [],
      stdout: '',
      stderr: 'command not found',
      exitCode: 1,
      success: false,
      durationMs: 10,
    });

    const result = await checkCppCompiler();
    expect(result.status).toBe('warn');
    expect(result.message).toContain('No supported C++ compiler');
  });
});
