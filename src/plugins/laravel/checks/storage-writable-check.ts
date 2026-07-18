import fs from 'node:fs';
import path from 'node:path';
import type { DiagnosticCheck } from '../../../core/types/diagnostic.js';

export async function checkLaravelStorageWritable(): Promise<DiagnosticCheck> {
  const cwd = process.cwd();
  const dirsToCheck = [
    'storage',
    path.join('storage', 'framework'),
    path.join('storage', 'logs'),
    path.join('bootstrap', 'cache'),
  ];

  const missingDirs: string[] = [];
  const unwritableDirs: string[] = [];

  for (const relPath of dirsToCheck) {
    const fullPath = path.join(cwd, relPath);

    if (!fs.existsSync(fullPath)) {
      missingDirs.push(relPath);
      continue;
    }

    try {
      fs.accessSync(fullPath, fs.constants.W_OK);
    } catch {
      unwritableDirs.push(relPath);
    }
  }

  if (missingDirs.length > 0 || unwritableDirs.length > 0) {
    const details: string[] = [];
    if (missingDirs.length > 0) {
      details.push(`Missing directories: ${missingDirs.join(', ')}`);
    }
    if (unwritableDirs.length > 0) {
      details.push(`Unwritable directories: ${unwritableDirs.join(', ')}`);
    }

    return {
      name: 'laravel-storage-writable',
      label: 'Laravel Storage & Cache Writability',
      status: 'fail',
      message: 'Laravel storage or cache directory is missing or unwritable.',
      detail:
        details.join('\n') +
        '\n\nLaravel needs write permissions to storage/ and bootstrap/cache/ for logging, session state caching, and compiled views/templates compilation.',
      suggestion:
        process.platform === 'win32'
          ? `Ensure permissions on these folders allow write access to the current Windows user.`
          : `Run: chmod -R 775 storage bootstrap/cache && chown -R :www-data storage bootstrap/cache (or your current web user)`,
    };
  }

  return {
    name: 'laravel-storage-writable',
    label: 'Laravel Storage & Cache Writability',
    status: 'pass',
    message: 'All storage and cache directories are writable.',
    detail:
      'Laravel storage, framework, logs, and bootstrap/cache directories are writable and present.',
  };
}
