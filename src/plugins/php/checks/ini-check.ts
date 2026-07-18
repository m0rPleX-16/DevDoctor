import fs from 'node:fs';
import type { DiagnosticCheck } from '../../../core/types/diagnostic.js';
import { runCommand } from '../../../infra/os/command-runner.js';

export async function checkPhpIni(): Promise<DiagnosticCheck> {
  try {
    const result = await runCommand('php', ['-r', 'echo php_ini_loaded_file();']);
    if (result.success) {
      const iniPath = result.stdout.trim();

      if (iniPath && fs.existsSync(iniPath)) {
        return {
          name: 'php-ini',
          label: 'php.ini Configuration File',
          status: 'pass',
          message: `Active php.ini found: ${iniPath}`,
          detail: `PHP configuration settings are loaded from: ${iniPath}`,
        };
      }
    }
  } catch {
    // fall through
  }

  return {
    name: 'php-ini',
    label: 'php.ini Configuration File',
    status: 'warn',
    message: 'Active php.ini file was not found or could not be verified.',
    detail:
      'PHP uses php.ini to configure settings like memory limits, upload sizes, and active extensions.',
    suggestion:
      'Run `php --ini` to locate configuration file paths. Ensure a php.ini file is loaded.',
  };
}
