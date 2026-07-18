import fs from 'node:fs';
import path from 'node:path';
import type { DiagnosticCheck } from '../../../core/types/diagnostic.js';

export async function checkNextjsEnvHygiene(): Promise<DiagnosticCheck> {
  const cwd = process.cwd();
  const envLocalPath = path.join(cwd, '.env.local');
  const envVars: Record<string, string | undefined> = { ...process.env };

  // Parse .env.local if it exists
  if (fs.existsSync(envLocalPath)) {
    try {
      const content = fs.readFileSync(envLocalPath, 'utf-8');
      const lines = content.split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const match = trimmed.match(/^([^=]+)=(.*)$/);
        if (match) {
          const key = match[1].trim();
          const val = match[2].trim();
          envVars[key] = val;
        }
      }
    } catch {
      // Ignore errors reading/parsing
    }
  }

  const sensitiveKeywords = ['secret', 'password', 'key', 'token', 'auth', 'private', 'credential'];
  const leakedSecrets: string[] = [];

  for (const key of Object.keys(envVars)) {
    if (key.startsWith('NEXT_PUBLIC_')) {
      const baseKey = key.slice('NEXT_PUBLIC_'.length).toLowerCase();
      const isSensitive = sensitiveKeywords.some((keyword) => baseKey.includes(keyword));

      // Exempt some common harmless public keys
      const isExempt = ['public', 'google_analytics', 'recaptcha', 'stripe_publishable'].some(
        (ex) => baseKey.includes(ex),
      );

      if (isSensitive && !isExempt) {
        leakedSecrets.push(key);
      }
    }
  }

  if (leakedSecrets.length > 0) {
    return {
      name: 'nextjs-env-hygiene',
      label: 'Next.js Environment Hygiene',
      status: 'warn',
      message: `Sensitive variables exposed to browser: ${leakedSecrets.join(', ')}`,
      detail:
        'Next.js automatically inline environment variables prefixed with "NEXT_PUBLIC_" into the browser bundle. Any sensitive values (e.g. database passwords, API secret keys) using this prefix will be leaked to the client.',
      suggestion:
        'Rename these variables to omit the "NEXT_PUBLIC_" prefix if they should only be accessed on the server side, and update your code to use them inside server-side contexts only (like getServerSideProps or API routes).',
    };
  }

  return {
    name: 'nextjs-env-hygiene',
    label: 'Next.js Environment Hygiene',
    status: 'pass',
    message: 'Environment variable hygiene looks healthy.',
    detail:
      'No sensitive keywords were detected in environment variables prefixed with "NEXT_PUBLIC_".',
  };
}
