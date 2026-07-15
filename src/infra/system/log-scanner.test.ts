import { describe, it, expect, vi, beforeEach } from 'vitest';
import { scanLogFile } from './log-scanner.js';
import fs from 'node:fs';

vi.mock('node:fs', () => ({
  default: {
    existsSync: vi.fn(),
    statSync: vi.fn(),
    readFileSync: vi.fn(),
  },
}));

describe('log-scanner', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should scan error strings and extract matches', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'statSync').mockReturnValue({ size: 1024 } as fs.Stats);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(`
      2026-07-13 10:00:01 [Note] Server starting...
      2026-07-13 10:00:02 [ERROR] Port 3306 occupied
      2026-07-13 10:00:03 [Note] Retrying binding...
      2026-07-13 10:00:04 [Note] Startup failed aborting
    `);

    const result = await scanLogFile('mock.log', {
      maxLines: 50,
      errorKeywords: ['error', 'failed'],
    });

    expect(result.exists).toBe(true);
    expect(result.totalLines).toBe(4);
    expect(result.matchedErrors).toHaveLength(2);
    expect(result.matchedErrors[0]).toContain('[ERROR] Port 3306 occupied');
    expect(result.matchedErrors[1]).toContain('Startup failed aborting');
  });

  it('should return missing status if file does not exist', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);

    const result = await scanLogFile('mock.log');

    expect(result.exists).toBe(false);
    expect(result.recentLines).toHaveLength(0);
  });
});
