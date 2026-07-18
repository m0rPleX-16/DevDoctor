import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PhpPlugin } from './index.js';
import * as commandRunner from '../../infra/os/command-runner.js';
import fs from 'node:fs';

vi.mock('../../infra/os/command-runner.js', () => ({
  runCommand: vi.fn(),
}));

vi.mock('node:fs', () => ({
  default: {
    existsSync: vi.fn(),
  },
}));

describe('php-plugin', () => {
  let plugin: PhpPlugin;

  beforeEach(() => {
    vi.resetAllMocks();
    plugin = new PhpPlugin();
  });

  it('should have name and description', () => {
    expect(plugin.name).toBe('php');
    expect(plugin.displayName).toBe('PHP');
    expect(plugin.category).toBe('language');
    expect(plugin.projectMarkers).toContain('composer.json');
  });

  it('should return skips if php is not installed', async () => {
    vi.spyOn(commandRunner, 'runCommand').mockRejectedValue(new Error('command not found'));

    const result = await plugin.diagnose();
    expect(result.overallStatus).toBe('fail');
    expect(result.checks).toHaveLength(3);
    expect(result.checks[0].status).toBe('fail');
    expect(result.checks[1].status).toBe('skip');
    expect(result.checks[2].status).toBe('skip');
  });

  it('should return pass if php and composer are fully configured', async () => {
    vi.spyOn(commandRunner, 'runCommand').mockImplementation(async (cmd, args) => {
      if (cmd === 'php' && args && args[0] === '-v') {
        return {
          command: 'php',
          args,
          success: true,
          stdout: 'PHP 8.2.12 (cli)',
          stderr: '',
          code: 0,
        };
      }
      if (cmd === 'php' && args && args[0] === '-r') {
        return {
          command: 'php',
          args,
          success: true,
          stdout: '/etc/php.ini',
          stderr: '',
          code: 0,
        };
      }
      if (cmd === 'composer') {
        return {
          command: 'composer',
          args,
          success: true,
          stdout: 'Composer version 2.7.2',
          stderr: '',
          code: 0,
        };
      }
      throw new Error('unknown');
    });

    vi.spyOn(fs, 'existsSync').mockReturnValue(true);

    const result = await plugin.diagnose();
    expect(result.overallStatus).toBe('pass');
    expect(result.checks[0].status).toBe('pass');
    expect(result.checks[1].status).toBe('pass');
    expect(result.checks[2].status).toBe('pass');
  });
});
