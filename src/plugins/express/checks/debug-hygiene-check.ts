import type { DiagnosticCheck } from '../../../core/types/diagnostic.js';

export async function checkExpressDebugHygiene(): Promise<DiagnosticCheck> {
  const debug = process.env.DEBUG;
  const isProd = process.env.NODE_ENV === 'production';

  if (debug && isProd && (debug === '*' || debug.includes('express:') || debug.includes('*'))) {
    return {
      name: 'express-debug-hygiene',
      label: 'DEBUG Variable Hygiene',
      status: 'warn',
      message: `Verbose DEBUG variable "${debug}" is active in production environment.`,
      detail:
        'The DEBUG environment variable controls console debug logging. Enabling verbose debugging (e.g. "*") in production mode logs internal execution traces which can degrade performance and leak sensitive data to server logs.',
      suggestion:
        'Remove or restrict the DEBUG environment variable in your production environment config.',
    };
  }

  return {
    name: 'express-debug-hygiene',
    label: 'DEBUG Variable Hygiene',
    status: 'pass',
    message: 'DEBUG environment variable is configured safely.',
    detail: 'DEBUG is either not active or not running in a production environment.',
  };
}
