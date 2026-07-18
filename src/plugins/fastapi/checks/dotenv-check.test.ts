import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import { checkFastapiDotenv } from './dotenv-check.js';

vi.mock('node:fs', () => ({
  default: {
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
  },
}));

describe('fastapi-dotenv-check', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should pass if python-dotenv is not in requirements', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue('fastapi==0.95.0\nuvicorn==0.22.0');

    const result = await checkFastapiDotenv();
    expect(result.status).toBe('pass');
    expect(result.message).toBe('Environment configuration file checks passed.');
  });

  it('should pass if python-dotenv is in requirements and .env exists', async () => {
    vi.spyOn(fs, 'existsSync').mockImplementation(() => {
      return true; // requirements.txt, pyproject.toml, and .env all exist
    });
    vi.spyOn(fs, 'readFileSync').mockReturnValue('python-dotenv==1.0.0');

    const result = await checkFastapiDotenv();
    expect(result.status).toBe('pass');
    expect(result.message).toBe('Environment configuration file checks passed.');
  });

  it('should warn if python-dotenv is in requirements but .env is missing', async () => {
    vi.spyOn(fs, 'existsSync').mockImplementation((path: any) => {
      if (path.includes('.env')) return false;
      return true; // requirements.txt exists
    });
    vi.spyOn(fs, 'readFileSync').mockReturnValue('python-dotenv==1.0.0');

    const result = await checkFastapiDotenv();
    expect(result.status).toBe('warn');
    expect(result.message).toBe('.env file is missing but dotenv dependencies are defined.');
  });

  it('should warn if pydantic-settings is in pyproject.toml but .env is missing', async () => {
    vi.spyOn(fs, 'existsSync').mockImplementation((path: any) => {
      if (path.includes('.env')) return false;
      if (path.includes('pyproject.toml')) return true;
      return false; // no requirements.txt
    });
    vi.spyOn(fs, 'readFileSync').mockReturnValue(
      '[tool.poetry.dependencies]\npydantic-settings = "^2.0.0"',
    );

    const result = await checkFastapiDotenv();
    expect(result.status).toBe('warn');
    expect(result.message).toBe('.env file is missing but dotenv dependencies are defined.');
  });
});
