import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import { checkCsharpTargetFramework } from './target-framework-check.js';

// We mock readdirSync to return a virtual file tree for the target framework check.
vi.mock('node:fs', () => ({
  default: {
    existsSync: vi.fn(),
    readdirSync: vi.fn(),
    readFileSync: vi.fn(),
  },
}));

describe('csharp-target-framework-check', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should pass when no C# projects are found', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readdirSync').mockReturnValue([] as any);

    const result = await checkCsharpTargetFramework();
    expect(result.status).toBe('pass');
    expect(result.message).toBe(
      'No .csproj or global.json files found to check target frameworks.',
    );
  });

  it('should pass when all projects target .NET 6 or newer', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readdirSync').mockReturnValue([
      { name: 'App.csproj', isFile: () => true, isDirectory: () => false },
      { name: 'global.json', isFile: () => true, isDirectory: () => false },
    ] as any);

    vi.spyOn(fs, 'readFileSync').mockImplementation((file: any) => {
      if (file.endsWith('App.csproj'))
        return '<Project><TargetFramework>net8.0</TargetFramework></Project>';
      if (file.endsWith('global.json')) return '{"sdk": {"version": "8.0.100"}}';
      return '';
    });

    const result = await checkCsharpTargetFramework();
    expect(result.status).toBe('pass');
    expect(result.message).toBe('.NET target framework versions are supported.');
  });

  it('should warn when a project targets a legacy framework like net5.0', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readdirSync').mockReturnValue([
      { name: 'App.csproj', isFile: () => true, isDirectory: () => false },
    ] as any);

    vi.spyOn(fs, 'readFileSync').mockReturnValue(
      '<Project><TargetFramework>net5.0</TargetFramework></Project>',
    );

    const result = await checkCsharpTargetFramework();
    expect(result.status).toBe('warn');
    expect(result.message).toBe('Legacy or unsupported .NET target frameworks detected.');
    expect(result.detail).toContain('targets "net5.0", which is out of support.');
  });

  it('should warn when a project targets netcoreapp3.1', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readdirSync').mockReturnValue([
      { name: 'App.csproj', isFile: () => true, isDirectory: () => false },
    ] as any);

    vi.spyOn(fs, 'readFileSync').mockReturnValue(
      '<Project><TargetFrameworks>netcoreapp3.1;net8.0</TargetFrameworks></Project>',
    );

    const result = await checkCsharpTargetFramework();
    expect(result.status).toBe('warn');
    expect(result.detail).toContain('targets legacy framework "netcoreapp3.1".');
  });

  it('should warn when global.json targets a legacy SDK version', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readdirSync').mockReturnValue([
      { name: 'global.json', isFile: () => true, isDirectory: () => false },
    ] as any);

    vi.spyOn(fs, 'readFileSync').mockReturnValue('{"sdk": {"version": "3.1.400"}}');

    const result = await checkCsharpTargetFramework();
    expect(result.status).toBe('warn');
    expect(result.detail).toContain('global.json specifies legacy SDK version "3.1.400".');
  });
});
