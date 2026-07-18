import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkDjangoDebug } from './debug-check.js';
import * as djangoUtils from '../django-utils.js';

vi.mock('../django-utils.js', () => ({
  findSettingsFiles: vi.fn(),
  parseDjangoSetting: vi.fn(),
}));

describe('django-debug-check', () => {
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

    const result = await checkDjangoDebug();
    expect(result.status).toBe('skip');
    expect(result.message).toBe('No settings.py files found in the current project.');
  });

  it('should pass if debug is true in development', async () => {
    vi.spyOn(djangoUtils, 'findSettingsFiles').mockReturnValue(['/project/settings.py']);
    vi.spyOn(djangoUtils, 'parseDjangoSetting').mockReturnValue('True');
    vi.stubEnv('DJANGO_ENV', 'development');

    const result = await checkDjangoDebug();
    expect(result.status).toBe('pass');
    expect(result.message).toBe('Django DEBUG setting is configured appropriately.');
  });

  it('should fail if debug is true in production', async () => {
    vi.spyOn(djangoUtils, 'findSettingsFiles').mockReturnValue(['/project/settings.py']);
    vi.spyOn(djangoUtils, 'parseDjangoSetting').mockReturnValue('True');
    vi.stubEnv('NODE_ENV', 'production');

    const result = await checkDjangoDebug();
    expect(result.status).toBe('fail');
    expect(result.message).toBe('Django DEBUG mode is active in a production environment!');
  });
});
