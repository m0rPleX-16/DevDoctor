import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import { checkNextjsCacheStaleness } from './cache-staleness-check.js';

vi.mock('node:fs', () => ({
  default: {
    existsSync: vi.fn(),
    statSync: vi.fn(),
    readdirSync: vi.fn(),
  },
}));

describe('nextjs-cache-staleness-check', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should pass if .next/cache does not exist', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);

    const result = await checkNextjsCacheStaleness();
    expect(result.status).toBe('pass');
    expect(result.message).toBe('Next.js cache size is healthy (0MB).');
  });

  it('should pass if cache is relatively small', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'statSync').mockReturnValue({
      isDirectory: () => false,
      size: 1024 * 1024 * 100, // 100MB
    } as any);

    const result = await checkNextjsCacheStaleness();
    expect(result.status).toBe('pass');
    expect(result.message).toBe('Next.js cache size is healthy (200MB).'); // Because next and node_modules exist and return 100MB each
  });

  it('should warn if cache is large (exceeds 500MB)', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'statSync').mockReturnValue({
      isDirectory: () => false,
      size: 1024 * 1024 * 300, // 300MB * 2 = 600MB
    } as any);

    const result = await checkNextjsCacheStaleness();
    expect(result.status).toBe('warn');
    expect(result.message).toContain('Next.js cache size is large');
  });
});
