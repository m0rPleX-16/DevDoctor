import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkExpressPort } from './port-check.js';

describe('express-port-check', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('should warn when PORT is not set', async () => {
    vi.stubEnv('PORT', '');

    const result = await checkExpressPort();
    expect(result.status).toBe('warn');
    expect(result.message).toBe('PORT environment variable is not defined.');
  });

  it('should pass when PORT is set', async () => {
    vi.stubEnv('PORT', '3000');

    const result = await checkExpressPort();
    expect(result.status).toBe('pass');
    expect(result.message).toBe('PORT environment variable is set to "3000".');
  });
});
