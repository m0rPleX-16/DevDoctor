import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkDjangoSettingsModule } from './settings-module-check.js';

describe('django-settings-module-check', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('should pass when DJANGO_SETTINGS_MODULE is set', async () => {
    vi.stubEnv('DJANGO_SETTINGS_MODULE', 'myproject.settings');

    const result = await checkDjangoSettingsModule();
    expect(result.status).toBe('pass');
    expect(result.message).toBe('DJANGO_SETTINGS_MODULE is set to "myproject.settings".');
  });

  it('should warn when DJANGO_SETTINGS_MODULE is not set', async () => {
    vi.stubEnv('DJANGO_SETTINGS_MODULE', '');

    const result = await checkDjangoSettingsModule();
    expect(result.status).toBe('warn');
    expect(result.message).toBe('DJANGO_SETTINGS_MODULE environment variable is not defined.');
  });
});
