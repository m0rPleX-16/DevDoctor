import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import { checkNextjsEnvHygiene } from './env-hygiene-check.js';

describe('nextjs-env-hygiene-check', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('should pass if no sensitive variables are exposed via NEXT_PUBLIC_', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://localhost:3000');

    const result = await checkNextjsEnvHygiene();
    expect(result.status).toBe('pass');
    expect(result.message).toBe('Environment variable hygiene looks healthy.');
  });

  it('should warn if sensitive variables are exposed in process.env', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);
    vi.stubEnv('NEXT_PUBLIC_SECRET_KEY', 'my-secret');
    vi.stubEnv('NEXT_PUBLIC_DB_PASSWORD', 'password123');

    const result = await checkNextjsEnvHygiene();
    expect(result.status).toBe('warn');
    expect(result.message).toContain('NEXT_PUBLIC_SECRET_KEY');
    expect(result.message).toContain('NEXT_PUBLIC_DB_PASSWORD');
  });

  it('should warn if sensitive variables are exposed in .env.local', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue('NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY=12345\n');

    const result = await checkNextjsEnvHygiene();
    expect(result.status).toBe('warn');
    expect(result.message).toContain('NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY');
  });
});
