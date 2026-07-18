import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import { checkFastapiVenv } from './venv-check.js';

vi.mock('node:fs', () => ({
  default: {
    existsSync: vi.fn(),
  },
}));

describe('fastapi-venv-check', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('should pass if VIRTUAL_ENV is set', async () => {
    vi.stubEnv('VIRTUAL_ENV', '/path/to/.venv');

    const result = await checkFastapiVenv();
    expect(result.status).toBe('pass');
    expect(result.message).toContain('/path/to/.venv');
  });

  it('should pass if CONDA_PREFIX is set', async () => {
    vi.stubEnv('CONDA_PREFIX', '/path/to/conda/env');

    const result = await checkFastapiVenv();
    expect(result.status).toBe('pass');
    expect(result.message).toContain('/path/to/conda/env');
  });

  it('should warn if no active env but local .venv exists', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);

    const result = await checkFastapiVenv();
    expect(result.status).toBe('warn');
    expect(result.message).toContain('Local virtual environment folder exists but is not active');
  });

  it('should warn if no active env and no local .venv folder exists', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);

    const result = await checkFastapiVenv();
    expect(result.status).toBe('warn');
    expect(result.message).toBe('No active Python virtual environment detected.');
  });
});
