import type { DiagnosticCheck } from '../../../core/types/diagnostic.js';

export async function checkExpressPort(): Promise<DiagnosticCheck> {
  const port = process.env.PORT;

  if (!port) {
    return {
      name: 'express-port',
      label: 'PORT Defined',
      status: 'warn',
      message: 'PORT environment variable is not defined.',
      detail:
        'Express apps typically bind to a port to listen for incoming HTTP requests. Hardcoding the port number in code violates the Twelve-Factor App methodology. Defining PORT via environment variables allows dynamic binding (e.g. on PaaS platforms like Heroku/Render).',
      suggestion:
        'Define a PORT environment variable in your .env file or environment settings (e.g. PORT=3000).',
    };
  }

  return {
    name: 'express-port',
    label: 'PORT Defined',
    status: 'pass',
    message: `PORT environment variable is set to "${port}".`,
    detail: 'Express application can bind to this port dynamically.',
  };
}
