import path from 'node:path';
import type { DiagnosticCheck } from '../../../core/types/diagnostic.js';
import { findSettingsFiles, parseDjangoSetting } from '../django-utils.js';

export async function checkDjangoSecretKey(): Promise<DiagnosticCheck> {
  const cwd = process.cwd();
  const settingsFiles = findSettingsFiles(cwd);

  if (settingsFiles.length === 0) {
    return {
      name: 'django-secret-key',
      label: 'Django SECRET_KEY Hygiene',
      status: 'skip',
      message: 'No settings.py files found in the current project.',
      detail: 'Cannot evaluate SECRET_KEY without a settings.py configuration file.',
    };
  }

  const warnings: string[] = [];

  for (const filePath of settingsFiles) {
    const fileName = path.relative(cwd, filePath);
    const secretKeyVal = parseDjangoSetting(filePath, 'SECRET_KEY');

    if (!secretKeyVal) {
      warnings.push(`SECRET_KEY not found in ${fileName}.`);
      continue;
    }

    if (secretKeyVal.includes('django-insecure-')) {
      warnings.push(`Default auto-generated insecure key found in ${fileName}.`);
    } else if (secretKeyVal.length < 30) {
      warnings.push(`SECRET_KEY is too short (< 30 characters) in ${fileName}.`);
    }

    // Check if hardcoded vs env-loaded
    // A hardcoded key is typically just a plain string. If it contains "os.environ" or "env" or "getenv" it is env-loaded.
    const isEnvLoaded =
      secretKeyVal.includes('environ') ||
      secretKeyVal.includes('env(') ||
      secretKeyVal.includes('getenv');
    if (!isEnvLoaded && !secretKeyVal.includes('django-insecure-') && secretKeyVal.length >= 30) {
      // It's a custom key but hardcoded
      warnings.push(
        `SECRET_KEY is hardcoded in ${fileName} instead of being loaded from environment variables.`,
      );
    }
  }

  if (warnings.length > 0) {
    return {
      name: 'django-secret-key',
      label: 'Django SECRET_KEY Hygiene',
      status: 'warn',
      message: 'Issues detected with Django SECRET_KEY configuration.',
      detail: warnings.join('\n'),
      suggestion:
        'Ensure Django SECRET_KEY is a strong, random, secret key loaded from environment variables (e.g. using python-dotenv or django-environ), and never commit the key to version control.',
    };
  }

  return {
    name: 'django-secret-key',
    label: 'Django SECRET_KEY Hygiene',
    status: 'pass',
    message: 'Django SECRET_KEY is configured securely.',
    detail:
      'All detected settings.py files configure SECRET_KEY via environment variables or strong custom keys.',
  };
}
