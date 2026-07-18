import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkExpressNodeEnv } from './node-env-check.js';

describe('express-node-env-check', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('should warn when NODE_ENV is not set', async () => {
    vi.stubEnv('NODE_ENV', '');

    const result = await checkExpressNodeEnv();
    expect(result.status).toBe('warn');
    expect(result.message).toBe('NODE_ENV environment variable is not defined.');
  });

  it('should pass when NODE_ENV is set to production', async () => {
    vi.stubEnv('NODE_ENV', 'production');

    const result = await checkExpressNodeEnv();
    expect(result.status).toBe('pass');
    expect(result.message).toBe('NODE_ENV is set to "production".');
  });

  it('should pass when NODE_ENV is set to development', async () => {
    vi.stubEnv('NODE_ENV', 'development');

    const result = await checkExpressNodeEnv();
    expect(result.status).toBe('pass');
    expect(result.message).toBe('NODE_ENV is set to "development".');
  });
});
