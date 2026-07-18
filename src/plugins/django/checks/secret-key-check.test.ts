import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkDjangoSecretKey } from './secret-key-check.js';
import * as djangoUtils from '../django-utils.js';

vi.mock('../django-utils.js', () => ({
  findSettingsFiles: vi.fn(),
  parseDjangoSetting: vi.fn(),
}));

describe('django-secret-key-check', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should skip if no settings files are found', async () => {
    vi.spyOn(djangoUtils, 'findSettingsFiles').mockReturnValue([]);

    const result = await checkDjangoSecretKey();
    expect(result.status).toBe('skip');
  });

  it('should warn if SECRET_KEY is not defined', async () => {
    vi.spyOn(djangoUtils, 'findSettingsFiles').mockReturnValue(['/project/settings.py']);
    vi.spyOn(djangoUtils, 'parseDjangoSetting').mockReturnValue(null);

    const result = await checkDjangoSecretKey();
    expect(result.status).toBe('warn');
    expect(result.detail).toContain('SECRET_KEY not found');
  });

  it('should warn if SECRET_KEY is default insecure', async () => {
    vi.spyOn(djangoUtils, 'findSettingsFiles').mockReturnValue(['/project/settings.py']);
    vi.spyOn(djangoUtils, 'parseDjangoSetting').mockReturnValue('django-insecure-1234567890abcdef');

    const result = await checkDjangoSecretKey();
    expect(result.status).toBe('warn');
    expect(result.detail).toContain('Default auto-generated insecure key found');
  });

  it('should warn if SECRET_KEY is too short', async () => {
    vi.spyOn(djangoUtils, 'findSettingsFiles').mockReturnValue(['/project/settings.py']);
    vi.spyOn(djangoUtils, 'parseDjangoSetting').mockReturnValue('shortkey');

    const result = await checkDjangoSecretKey();
    expect(result.status).toBe('warn');
    expect(result.detail).toContain('SECRET_KEY is too short');
  });

  it('should warn if SECRET_KEY is hardcoded', async () => {
    vi.spyOn(djangoUtils, 'findSettingsFiles').mockReturnValue(['/project/settings.py']);
    vi.spyOn(djangoUtils, 'parseDjangoSetting').mockReturnValue(
      'this-is-a-very-long-hardcoded-secret-key-that-is-over-30-chars',
    );

    const result = await checkDjangoSecretKey();
    expect(result.status).toBe('warn');
    expect(result.detail).toContain('SECRET_KEY is hardcoded');
  });

  it('should pass if SECRET_KEY is loaded from environment', async () => {
    vi.spyOn(djangoUtils, 'findSettingsFiles').mockReturnValue(['/project/settings.py']);
    vi.spyOn(djangoUtils, 'parseDjangoSetting').mockReturnValue(
      'os.environ.get("THIS_IS_A_VERY_LONG_SECRET_KEY_VAR_NAME_THAT_EXCEEDS_30_CHARS")',
    );

    const result = await checkDjangoSecretKey();
    expect(result.status).toBe('pass');
  });
});
