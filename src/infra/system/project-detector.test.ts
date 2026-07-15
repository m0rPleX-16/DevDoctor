import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { detectProjectContext } from './project-detector.js';
import type { Plugin } from '../../core/types/plugin.js';

vi.mock('node:fs', () => ({
  default: {
    existsSync: vi.fn(),
    statSync: vi.fn(),
    readdirSync: vi.fn(),
  },
}));

describe('project-detector', () => {
  const mockPlugins: Plugin[] = [
    {
      name: 'node',
      displayName: 'Node.js',
      description: 'Node plugin',
      projectMarkers: ['package.json', 'node_modules'],
      diagnose: vi.fn(),
      repair: vi.fn(),
      verify: vi.fn(),
    },
    {
      name: 'python',
      displayName: 'Python',
      description: 'Python plugin',
      projectMarkers: ['*.py', 'requirements.txt'],
      diagnose: vi.fn(),
      repair: vi.fn(),
      verify: vi.fn(),
    },
    {
      name: 'git',
      displayName: 'Git',
      description: 'Git plugin',
      projectMarkers: ['.git'],
      diagnose: vi.fn(),
      repair: vi.fn(),
      verify: vi.fn(),
    },
  ];

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should detect exact matches in the current directory', () => {
    const cwd = '/mock/project';

    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.statSync).mockReturnValue({
      isDirectory: () => true,
    } as fs.Stats);

    vi.mocked(fs.readdirSync).mockImplementation((dirPath) => {
      if (dirPath === path.resolve(cwd)) {
        return ['package.json', 'index.js'] as any;
      }
      return [] as any;
    });

    const context = detectProjectContext(mockPlugins, cwd);

    expect(context.detectedPlugins.has('node')).toBe(true);
    expect(context.matchedMarkers['node']).toContain('package.json');
    expect(context.detectedPlugins.has('python')).toBe(false);
  });

  it('should traverse upward to find root markers like .git', () => {
    const root = '/mock/project';
    const subDir = '/mock/project/src/cli';

    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.statSync).mockReturnValue({
      isDirectory: () => true,
    } as fs.Stats);

    vi.mocked(fs.readdirSync).mockImplementation((dirPath) => {
      const resolved = path.resolve(dirPath as string);
      if (resolved === path.resolve(root)) {
        return ['.git', 'package.json'] as any;
      }
      if (resolved === path.resolve(subDir)) {
        return ['index.ts'] as any;
      }
      return [] as any;
    });

    const context = detectProjectContext(mockPlugins, subDir);

    // Should find git marker in parent directory
    expect(context.detectedPlugins.has('git')).toBe(true);
    expect(context.matchedMarkers['git']).toContain('.git');

    // Should find node marker in parent directory
    expect(context.detectedPlugins.has('node')).toBe(true);
    expect(context.matchedMarkers['node']).toContain('package.json');
  });

  it('should support extension pattern matching (e.g. *.py)', () => {
    const cwd = '/mock/project';

    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.statSync).mockReturnValue({
      isDirectory: () => true,
    } as fs.Stats);

    vi.mocked(fs.readdirSync).mockImplementation((dirPath) => {
      if (path.resolve(dirPath as string) === path.resolve(cwd)) {
        return ['main.py', 'utils.py', 'README.md'] as any;
      }
      return [] as any;
    });

    const context = detectProjectContext(mockPlugins, cwd);

    expect(context.detectedPlugins.has('python')).toBe(true);
    expect(context.matchedMarkers['python']).toContain('*.py');
  });

  it('should stop traversal at the home directory or root', () => {
    const home = os.homedir();
    const child = path.join(home, 'some', 'deep', 'folder', 'structure', 'sub');

    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.statSync).mockReturnValue({
      isDirectory: () => true,
    } as fs.Stats);

    // Record list of directories read
    const traversedDirs: string[] = [];
    vi.mocked(fs.readdirSync).mockImplementation((dirPath) => {
      traversedDirs.push(path.resolve(dirPath as string));
      return [] as any;
    });

    detectProjectContext(mockPlugins, child);

    // Traversal shouldn't exceed 5 levels, and should stop if it reaches homeDir
    expect(traversedDirs.length).toBeLessThanOrEqual(5);
    // Home directory itself should be checked (as the boundary) but not its parents
    const parentOfHome = path.dirname(home);
    expect(traversedDirs).not.toContain(path.resolve(parentOfHome));
  });
});
