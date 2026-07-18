import fs from 'node:fs';
import path from 'node:path';
import type { DiagnosticCheck } from '../../../core/types/diagnostic.js';

export async function checkLaravelAppKey(): Promise<DiagnosticCheck> {
  const cwd = process.cwd();
  const envPath = path.join(cwd, '.env');

  if (!fs.existsSync(envPath)) {
    return {
      name: 'laravel-app-key',
      label: 'Laravel APP_KEY Configuration',
      status: 'skip',
      message: 'Skipped: .env file does not exist.',
      dependsOn: ['laravel-env'],
    };
  }

  let appKey: string | undefined;
  try {
    const content = fs.readFileSync(envPath, 'utf-8');
    const match = content.match(/^APP_KEY=(.*)$/m);
    if (match) {
      appKey = match[1].trim();
    }
  } catch {
    // Ignore errors
  }

  if (!appKey) {
    return {
      name: 'laravel-app-key',
      label: 'Laravel APP_KEY Configuration',
      status: 'fail',
      message: 'APP_KEY is not defined in .env.',
      detail:
        'Laravel uses the APP_KEY to encrypt cookies, sessions, and other sensitive payloads. If it is empty or missing, your application will throw an exception on start.',
      suggestion: 'Generate an application key using artisan: `php artisan key:generate`',
      dependsOn: ['laravel-env'],
    };
  }

  // Check if it is a valid base64 key or raw 32-character key
  const isValidBase64 = appKey.startsWith('base64:') && appKey.length > 7;
  const isValidRaw = appKey.length === 32;

  if (!isValidBase64 && !isValidRaw) {
    return {
      name: 'laravel-app-key',
      label: 'Laravel APP_KEY Configuration',
      status: 'warn',
      message: 'APP_KEY is defined but may be invalid or insecure.',
      detail: `Current value: "${appKey}". Standard Laravel APP_KEYs should either be a 32-character string or prefixed with "base64:" followed by a base64 encoded string.`,
      suggestion: 'Regenerate a secure encryption key using: `php artisan key:generate`',
      dependsOn: ['laravel-env'],
    };
  }

  return {
    name: 'laravel-app-key',
    label: 'Laravel APP_KEY Configuration',
    status: 'pass',
    message: 'APP_KEY is configured correctly.',
    detail: 'A valid encryption key is present in your .env configuration.',
    dependsOn: ['laravel-env'],
  };
}
