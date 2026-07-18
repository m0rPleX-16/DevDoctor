import path from 'node:path';
import type { DiagnosticCheck } from '../../../core/types/diagnostic.js';
import { findSettingsFiles, parseDjangoSetting } from '../django-utils.js';

export async function checkDjangoAllowedHosts(): Promise<DiagnosticCheck> {
  const cwd = process.cwd();
  const settingsFiles = findSettingsFiles(cwd);

  if (settingsFiles.length === 0) {
    return {
      name: 'django-allowed-hosts',
      label: 'Django ALLOWED_HOSTS Configuration',
      status: 'skip',
      message: 'No settings.py files found in the current project.',
      detail: 'Cannot evaluate ALLOWED_HOSTS setting without a settings.py configuration file.',
    };
  }

  const warnings: string[] = [];
  const isProd = ['production', 'prod'].includes(
    (process.env.NODE_ENV || process.env.DJANGO_ENV || '').toLowerCase(),
  );

  for (const filePath of settingsFiles) {
    const fileName = path.relative(cwd, filePath);
    const allowedHostsVal = parseDjangoSetting(filePath, 'ALLOWED_HOSTS');

    if (!allowedHostsVal) {
      warnings.push(`ALLOWED_HOSTS is not defined in ${fileName}.`);
      continue;
    }

    const cleanVal = allowedHostsVal.replace(/\s/g, '');
    const isEmpty = cleanVal === '[]' || cleanVal === '()' || cleanVal === 'set()';
    const hasWildcard =
      cleanVal.includes('*') || cleanVal.includes("'*'") || cleanVal.includes('"*"');

    if (isEmpty && isProd) {
      warnings.push(
        `ALLOWED_HOSTS is empty in ${fileName}. In production with DEBUG=False, this will cause all requests to fail with a 400 Bad Request error.`,
      );
    } else if (hasWildcard && isProd) {
      warnings.push(
        `ALLOWED_HOSTS contains a wildcard (*) in ${fileName}. This is a security risk in production environments as it exposes the site to Host header injection attacks.`,
      );
    }
  }

  if (warnings.length > 0) {
    return {
      name: 'django-allowed-hosts',
      label: 'Django ALLOWED_HOSTS Configuration',
      status: 'warn',
      message: 'Issues detected in Django ALLOWED_HOSTS configuration.',
      detail: warnings.join('\n'),
      suggestion:
        'Populate ALLOWED_HOSTS with a list of host/domain names that this Django site will serve (e.g. ALLOWED_HOSTS = ["example.com", "www.example.com"]).',
    };
  }

  return {
    name: 'django-allowed-hosts',
    label: 'Django ALLOWED_HOSTS Configuration',
    status: 'pass',
    message: 'Django ALLOWED_HOSTS configuration looks healthy.',
    detail:
      'All settings.py files configure ALLOWED_HOSTS appropriately for development and production.',
  };
}
