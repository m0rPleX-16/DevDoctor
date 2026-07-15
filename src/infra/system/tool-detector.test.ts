import { describe, it, expect, vi, beforeEach } from 'vitest';
import { detectTools } from './tool-detector.js';
import * as commandRunner from '../os/command-runner.js';

vi.mock('../os/command-runner.js', () => ({
  runCommand: vi.fn(),
}));

describe('tool-detector', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should detect when tools are installed and parse version correctly', async () => {
    // Mock runCommand to succeed for all tools
    vi.spyOn(commandRunner, 'runCommand').mockImplementation(
      async (command, args = [], _options = {}) => {
        if (command === 'node') {
          return {
            command,
            args,
            stdout: 'v20.11.0',
            stderr: '',
            exitCode: 0,
            success: true,
            durationMs: 5,
          };
        }
        if (command === 'npm') {
          return {
            command,
            args,
            stdout: '10.2.4',
            stderr: '',
            exitCode: 0,
            success: true,
            durationMs: 5,
          };
        }
        if (command === 'git') {
          return {
            command,
            args,
            stdout: 'git version 2.43.0.windows.1',
            stderr: '',
            exitCode: 0,
            success: true,
            durationMs: 5,
          };
        }
        // Mock 'where' or 'which' call
        if (command === 'where' || command === 'which') {
          return {
            command,
            args,
            stdout: `C:\\MockPath\\${args[0]}.exe`,
            stderr: '',
            exitCode: 0,
            success: true,
            durationMs: 5,
          };
        }
        return {
          command,
          args,
          stdout: '1.0.0',
          stderr: '',
          exitCode: 0,
          success: true,
          durationMs: 5,
        };
      },
    );

    const tools = await detectTools();

    const nodeTool = tools.find((t) => t.command === 'node');
    expect(nodeTool).toBeDefined();
    expect(nodeTool?.installed).toBe(true);
    expect(nodeTool?.version).toBe('20.11.0');
    expect(nodeTool?.path).toBe('C:\\MockPath\\node.exe');

    const gitTool = tools.find((t) => t.command === 'git');
    expect(gitTool).toBeDefined();
    expect(gitTool?.installed).toBe(true);
    expect(gitTool?.version).toBe('2.43.0.windows.1');
  });

  it('should handle tools that are not installed', async () => {
    // Mock runCommand to fail for all tools except path resolution
    vi.spyOn(commandRunner, 'runCommand').mockImplementation(
      async (command, args = [], _options = {}) => {
        return {
          command,
          args,
          stdout: '',
          stderr: 'command not found',
          exitCode: 127,
          success: false,
          durationMs: 5,
        };
      },
    );

    const tools = await detectTools();

    for (const tool of tools) {
      expect(tool.installed).toBe(false);
      expect(tool.version).toBeUndefined();
      expect(tool.path).toBeUndefined();
    }
  });
});
