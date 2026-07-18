import path from 'node:path';
import type { DiagnosticCheck } from '../../../core/types/diagnostic.js';
import { findSettingsFiles, parseDjangoSetting } from '../django-utils.js';

export async function checkDjangoDebug(): Promise<DiagnosticCheck> {
  const cwd = process.cwd();
  const settingsFiles = findSettingsFiles(cwd);

  if (settingsFiles.length === 0) {
    return {
      name: 'django-debug',
      label: 'Django DEBUG Status',
      status: 'skip',
      message: 'No settings.py files found in the current project.',
      detail: 'Cannot evaluate DEBUG setting without a settings.py configuration file.',
    };
  }

  const warnings: string[] = [];
  const isProd = ['production', 'prod'].includes(
    (process.env.NODE_ENV || process.env.DJANGO_ENV || '').toLowerCase(),
  );

  for (const filePath of settingsFiles) {
    const fileName = path.relative(cwd, filePath);
    const debugVal = parseDjangoSetting(filePath, 'DEBUG');

    if (debugVal === 'True') {
      if (isProd) {
        warnings.push(`DEBUG is set to True in production environment in ${fileName}.`);
      } else {
        // Just a friendly reminder in development/default
        // We will return a warning or pass depending on if we are running in dev or prod
      }
    }
  }

  if (warnings.length > 0) {
    return {
      name: 'django-debug',
      label: 'Django DEBUG Status',
      status: 'fail',
      message: 'Django DEBUG mode is active in a production environment!',
      detail: warnings.join('\n'),
      suggestion:
        'Set DEBUG = False in your production settings.py file, or load it from an environment variable (e.g. DEBUG = os.getenv("DJANGO_DEBUG", "False") == "True").',
    };
  }

  // If no fails/warns but some settings files have DEBUG = True in dev mode, we can pass with info
  return {
    name: 'django-debug',
    label: 'Django DEBUG Status',
    status: 'pass',
    message: 'Django DEBUG setting is configured appropriately.',
    detail: 'No production configuration was found running with DEBUG = True.',
  };
}
