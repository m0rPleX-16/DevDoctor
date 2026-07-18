import fs from 'node:fs';
import path from 'node:path';
import type { DiagnosticCheck } from '../../../core/types/diagnostic.js';

export async function checkLaravelVendor(): Promise<DiagnosticCheck> {
  const cwd = process.cwd();
  const vendorPath = path.join(cwd, 'vendor');

  if (!fs.existsSync(vendorPath)) {
    return {
      name: 'laravel-vendor',
      label: 'Laravel Dependencies',
      status: 'fail',
      message: 'vendor directory is not present.',
      detail:
        'Laravel depends on Composer packages located in the vendor directory. If it is missing, none of the classes (including the framework itself) will be available.',
      suggestion: 'Run `composer install` to download dependencies and generate the autoloader.',
    };
  }

  return {
    name: 'laravel-vendor',
    label: 'Laravel Dependencies',
    status: 'pass',
    message: 'vendor directory is present.',
    detail: 'Composer dependencies appear to be installed.',
  };
}
