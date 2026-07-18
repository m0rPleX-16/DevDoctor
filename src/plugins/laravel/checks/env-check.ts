import fs from 'node:fs';
import path from 'node:path';
import type { DiagnosticCheck } from '../../../core/types/diagnostic.js';

export async function checkLaravelEnv(): Promise<DiagnosticCheck> {
  const cwd = process.cwd();
  const envPath = path.join(cwd, '.env');

  if (!fs.existsSync(envPath)) {
    return {
      name: 'laravel-env',
      label: 'Laravel .env Presence',
      status: 'fail',
      message: '.env file is not present in the project root directory.',
      detail:
        'Laravel reads all its configurations from the environment. Locally, this is done by reading a `.env` file in the root. Without it, Laravel will fail to start or configure critical database and session parameters.',
      suggestion:
        'Duplicate the template file (e.g. `cp .env.example .env`) and populate it with your local development credentials.',
    };
  }

  return {
    name: 'laravel-env',
    label: 'Laravel .env Presence',
    status: 'pass',
    message: '.env file is present.',
    detail: 'Laravel configuration environment file (.env) detected successfully.',
  };
}
