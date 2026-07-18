import { runCommand } from '../../../infra/os/command-runner.js';
import type { DiagnosticCheck } from '../../../core/types/diagnostic.js';

export async function checkFastapiUvicorn(): Promise<DiagnosticCheck> {
  // Try running uvicorn directly
  let result = await runCommand('uvicorn', ['--version']);

  // If that fails, try running via python
  if (!result.success) {
    result = await runCommand('python', ['-m', 'uvicorn', '--version']);
  }
  if (!result.success) {
    result = await runCommand('python3', ['-m', 'uvicorn', '--version']);
  }

  if (!result.success) {
    return {
      name: 'fastapi-uvicorn',
      label: 'Uvicorn Installation',
      status: 'warn',
      message: 'Uvicorn ASGI server is not installed or not accessible.',
      detail:
        'FastAPI requires an ASGI server (like Uvicorn, Hypercorn, or Daphne) to run. Uvicorn is the industry standard for development.',
      suggestion: 'Install Uvicorn using pip: pip install uvicorn[standard]',
    };
  }

  const version = result.stdout.trim() || result.stderr.trim();
  return {
    name: 'fastapi-uvicorn',
    label: 'Uvicorn Installation',
    status: 'pass',
    message: `Uvicorn is installed. Version info: ${version}`,
    detail: 'Uvicorn ASGI server is available to run your FastAPI application.',
  };
}
