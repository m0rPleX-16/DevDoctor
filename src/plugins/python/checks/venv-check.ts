import type { DiagnosticCheck } from '../../../core/types/diagnostic.js';

/**
 * Check whether a Python virtual environment is currently active.
 *
 * A venv is active when the VIRTUAL_ENV environment variable is set by
 * the activation script. We also check CONDA_DEFAULT_ENV for Conda users.
 */
export async function checkPythonVenv(): Promise<DiagnosticCheck> {
  const venvPath = process.env.VIRTUAL_ENV;
  const condaEnv = process.env.CONDA_DEFAULT_ENV;
  const condaPrefix = process.env.CONDA_PREFIX;

  if (venvPath) {
    return {
      name: 'python-venv',
      label: 'Virtual Environment',
      status: 'pass',
      message: `Active virtualenv: ${venvPath}`,
      detail:
        'A Python virtual environment is active. Virtual environments isolate project ' +
        'dependencies so that packages installed for one project do not conflict with ' +
        "another project's packages or the system Python.",
      dependsOn: ['python-installation'],
    };
  }

  if (condaEnv && condaEnv !== 'base') {
    return {
      name: 'python-venv',
      label: 'Virtual Environment',
      status: 'pass',
      message: `Active Conda environment: ${condaEnv}${condaPrefix ? ` (${condaPrefix})` : ''}.`,
      detail:
        'A Conda environment is active. Conda environments provide similar isolation to ' +
        'virtualenvs and also manage non-Python dependencies.',
      dependsOn: ['python-installation'],
    };
  }

  return {
    name: 'python-venv',
    label: 'Virtual Environment',
    status: 'warn',
    message: 'No active Python virtual environment detected.',
    detail:
      'Working without a virtual environment means pip packages are installed globally. ' +
      'This can cause version conflicts between projects and pollute the system Python. ' +
      'It is best practice to use a virtual environment per project.',
    suggestion:
      'Create and activate a virtual environment for your project:\n' +
      '  python3 -m venv .venv\n' +
      '  source .venv/bin/activate     (macOS/Linux)\n' +
      '  .venv\\Scripts\\activate        (Windows PowerShell)\n' +
      'Or use tools like poetry, pipenv, or conda for environment management.',
    dependsOn: ['python-installation'],
  };
}
