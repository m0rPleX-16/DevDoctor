import type { DiagnosticCheck } from '../../../core/types/diagnostic.js';

export async function checkExpressNodeEnv(): Promise<DiagnosticCheck> {
  const nodeEnv = process.env.NODE_ENV;

  if (!nodeEnv) {
    return {
      name: 'express-node-env',
      label: 'NODE_ENV Defined',
      status: 'warn',
      message: 'NODE_ENV environment variable is not defined.',
      detail:
        'Express relies heavily on the NODE_ENV environment variable. When set to "production", Express optimizes performance by caching views, stylesheets, and logging less verbosely. Unset NODE_ENV defaults to development mode, which has severe performance overhead in production.',
      suggestion:
        'Set NODE_ENV to "production" in your production environment config or .env file. Locally, set it to "development" or "test".',
    };
  }

  return {
    name: 'express-node-env',
    label: 'NODE_ENV Defined',
    status: 'pass',
    message: `NODE_ENV is set to "${nodeEnv}".`,
    detail: `Express will run in ${nodeEnv} mode.`,
  };
}
