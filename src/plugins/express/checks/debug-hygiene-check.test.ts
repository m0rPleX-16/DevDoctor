import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkExpressDebugHygiene } from './debug-hygiene-check.js';

describe('express-debug-hygiene-check', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('should pass if DEBUG is not set', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('DEBUG', '');

    const result = await checkExpressDebugHygiene();
    expect(result.status).toBe('pass');
  });

  it('should pass if DEBUG is set in development', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('DEBUG', '*');

    const result = await checkExpressDebugHygiene();
    expect(result.status).toBe('pass');
  });

  it('should warn if DEBUG is * in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('DEBUG', '*');

    const result = await checkExpressDebugHygiene();
    expect(result.status).toBe('warn');
    expect(result.message).toContain(
      'Verbose DEBUG variable "*" is active in production environment.',
    );
  });

  it('should warn if DEBUG includes express: in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('DEBUG', 'express:*');

    const result = await checkExpressDebugHygiene();
    expect(result.status).toBe('warn');
    expect(result.message).toContain(
      'Verbose DEBUG variable "express:*" is active in production environment.',
    );
  });
});
