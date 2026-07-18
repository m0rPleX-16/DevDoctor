import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { checkNextjsEnvLocal } from './env-local-check.js';

vi.mock('node:fs', () => ({
  default: {
    existsSync: vi.fn(),
  },
}));

describe('nextjs-env-local-check', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should pass if any env file is present', async () => {
    vi.spyOn(fs, 'existsSync').mockImplementation((file: any) => {
      if (file.includes('.env.local')) return true;
      return false;
    });

    const result = await checkNextjsEnvLocal();
    expect(fs.existsSync).toHaveBeenCalledWith(path.join(process.cwd(), '.env.local'));
    expect(result.status).toBe('pass');
    expect(result.message).toBe('Environment files found: .env.local.');
  });

  it('should pass and list multiple if multiple env files are present', async () => {
    vi.spyOn(fs, 'existsSync').mockImplementation((file: any) => {
      if (file.includes('.env.local')) return true;
      if (file.includes('.env.production')) return true;
      return false;
    });

    const result = await checkNextjsEnvLocal();
    expect(result.status).toBe('pass');
    expect(result.message).toBe('Environment files found: .env.local, .env.production.');
  });

  it('should warn if no env files are missing', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);

    const result = await checkNextjsEnvLocal();
    expect(result.status).toBe('warn');
    expect(result.message).toBe(
      'No Next.js environment files (.env.local, .env, etc.) were found in the root directory.',
    );
  });
});
