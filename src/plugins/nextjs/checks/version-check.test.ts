import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import { checkNextjsVersion } from './version-check.js';

vi.mock('node:fs', () => ({
  default: {
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
  },
}));

describe('nextjs-version-check', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should pass when next version is found', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockImplementation((path: any) => {
      if (path.includes('node_modules')) return JSON.stringify({ version: '14.2.5' });
      return JSON.stringify({ dependencies: { next: '^14.2.5' } });
    });

    const result = await checkNextjsVersion();
    expect(result.status).toBe('pass');
    expect(result.message).toContain('Next.js v14.2.5 is installed.');
  });

  it('should fail when package.json is missing', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);

    const result = await checkNextjsVersion();
    expect(result.status).toBe('fail');
    expect(result.message).toBe('package.json not found in the current directory.');
  });

  it('should fail when next is not in package.json', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify({ dependencies: {} }));

    const result = await checkNextjsVersion();
    expect(result.status).toBe('fail');
    expect(result.message).toBe('Next.js is not listed as a dependency in package.json.');
  });
});
