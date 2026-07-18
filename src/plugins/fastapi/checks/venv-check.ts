import fs from 'node:fs';
import path from 'node:path';
import type { DiagnosticCheck } from '../../../core/types/diagnostic.js';

export async function checkFastapiVenv(): Promise<DiagnosticCheck> {
  const venvPath =
    process.env.VIRTUAL_ENV || process.env.CONDA_PREFIX || process.env.UV_PROJECT_ENVIRONMENT;
  const cwd = process.cwd();

  if (venvPath) {
    return {
      name: 'fastapi-venv',
      label: 'Virtual Environment Active',
      status: 'pass',
      message: `Active virtual environment detected at: ${venvPath}`,
      detail:
        'Running FastAPI inside a virtual environment prevents dependency conflicts with other python projects or the system installation.',
    };
  }

  // Check if a local .venv or venv exists
  const localVenv = fs.existsSync(path.join(cwd, '.venv')) || fs.existsSync(path.join(cwd, 'venv'));
  if (localVenv) {
    return {
      name: 'fastapi-venv',
      label: 'Virtual Environment Active',
      status: 'warn',
      message: 'Local virtual environment folder exists but is not active in this shell.',
      detail:
        'A virtual environment folder (.venv/venv) was found, but it has not been activated. Commands executed outside the active virtual environment might fall back to global package versions.',
      suggestion:
        process.platform === 'win32'
          ? 'Activate your virtual environment by running: .venv\\Scripts\\activate'
          : 'Activate your virtual environment by running: source .venv/bin/activate',
    };
  }

  return {
    name: 'fastapi-venv',
    label: 'Virtual Environment Active',
    status: 'warn',
    message: 'No active Python virtual environment detected.',
    detail:
      'FastAPI projects should run within a virtual environment to manage dependencies cleanly.',
    suggestion:
      'Create a virtual environment: python -m venv .venv && source .venv/bin/activate (or .venv\\Scripts\\activate on Windows)',
  };
}
