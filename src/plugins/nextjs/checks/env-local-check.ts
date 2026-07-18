import fs from 'node:fs';
import path from 'node:path';
import type { DiagnosticCheck } from '../../../core/types/diagnostic.js';

export async function checkNextjsEnvLocal(): Promise<DiagnosticCheck> {
  const cwd = process.cwd();
  const envFiles = ['.env.local', '.env.development', '.env.production', '.env'];

  const foundFiles = envFiles.filter((file) => fs.existsSync(path.join(cwd, file)));

  if (foundFiles.length === 0) {
    return {
      name: 'nextjs-env-local',
      label: 'Next.js Environment Files',
      status: 'warn',
      message:
        'No Next.js environment files (.env.local, .env, etc.) were found in the root directory.',
      detail:
        'Next.js uses files like .env.local, .env.development, and .env to load environment variables locally for development and testing. Keeping environment variables out of version control is a security best practice.',
      suggestion:
        'Create a .env.local or .env file in the project root to define local environment variables, and ensure it is added to .gitignore.',
    };
  }

  return {
    name: 'nextjs-env-local',
    label: 'Next.js Environment Files',
    status: 'pass',
    message: `Environment files found: ${foundFiles.join(', ')}.`,
    detail:
      'Next.js will automatically load variables defined in these files according to its environment hierarchy.',
  };
}
