import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkDjangoAllowedHosts } from './allowed-hosts-check.js';
import * as djangoUtils from '../django-utils.js';

vi.mock('../django-utils.js', () => ({
  findSettingsFiles: vi.fn(),
  parseDjangoSetting: vi.fn(),
}));

describe('django-allowed-hosts-check', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('should skip if no settings files are found', async () => {
    vi.spyOn(djangoUtils, 'findSettingsFiles').mockReturnValue([]);

    const result = await checkDjangoAllowedHosts();
    expect(result.status).toBe('skip');
  });

  it('should warn if ALLOWED_HOSTS is not defined', async () => {
    vi.spyOn(djangoUtils, 'findSettingsFiles').mockReturnValue(['/project/settings.py']);
    vi.spyOn(djangoUtils, 'parseDjangoSetting').mockReturnValue(null);

    const result = await checkDjangoAllowedHosts();
    expect(result.status).toBe('warn');
    expect(result.detail).toContain('ALLOWED_HOSTS is not defined');
  });

  it('should warn if ALLOWED_HOSTS is empty in production', async () => {
    vi.spyOn(djangoUtils, 'findSettingsFiles').mockReturnValue(['/project/settings.py']);
    vi.spyOn(djangoUtils, 'parseDjangoSetting').mockReturnValue('[]');
    vi.stubEnv('NODE_ENV', 'production');

    const result = await checkDjangoAllowedHosts();
    expect(result.status).toBe('warn');
    expect(result.detail).toContain('ALLOWED_HOSTS is empty');
  });

  it('should warn if ALLOWED_HOSTS contains a wildcard in production', async () => {
    vi.spyOn(djangoUtils, 'findSettingsFiles').mockReturnValue(['/project/settings.py']);
    vi.spyOn(djangoUtils, 'parseDjangoSetting').mockReturnValue("['*']");
    vi.stubEnv('NODE_ENV', 'production');

    const result = await checkDjangoAllowedHosts();
    expect(result.status).toBe('warn');
    expect(result.detail).toContain('ALLOWED_HOSTS contains a wildcard');
  });

  it('should pass if ALLOWED_HOSTS is properly configured', async () => {
    vi.spyOn(djangoUtils, 'findSettingsFiles').mockReturnValue(['/project/settings.py']);
    vi.spyOn(djangoUtils, 'parseDjangoSetting').mockReturnValue("['example.com']");
    vi.stubEnv('DJANGO_ENV', 'production');

    const result = await checkDjangoAllowedHosts();
    expect(result.status).toBe('pass');
  });
});
