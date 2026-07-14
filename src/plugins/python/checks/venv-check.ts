/**
 * Virtual Environment Check
 *
 * Detects whether a Python virtual environment is active in the current
 * process. Only warns when the check is run inside a directory that looks
 * like a Python project — reduces false positives when `devdoctor doctor`
 * is run from a non-Python working directory.
 *
 * Environments detected (pass):
 *   - Standard venv / virtualenv  → VIRTUAL_ENV is set
 *   - Conda (non-base)            → CONDA_DEFAULT_ENV is set and not 'base'
 *   - Poetry                      → POETRY_ACTIVE is set, or pyproject.toml
 *                                    has [tool.poetry] and a .venv dir exists
 *   - uv                          → UV_PROJECT_ENVIRONMENT or a .venv dir
 *                                    created by uv exists alongside uv.lock
 *
 * Context-aware (warn only in Python projects):
 *   A missing venv is only flagged when the current directory contains at
 *   least one Python project marker. Running `devdoctor` from a Node or
 *   unrelated directory will not produce a spurious venv warning.
 */

import fs from 'node:fs';
import path from 'node:path';
import type { DiagnosticCheck } from '../../../core/types/diagnostic.js';

/** Python project markers — presence of any of these signals a Python project. */
const PYTHON_PROJECT_MARKERS = [
  'requirements.txt',
  'pyproject.toml',
  'setup.py',
  'setup.cfg',
  'Pipfile',
  '.python-version',
  'uv.lock',
  'poetry.lock',
];

function isPythonProject(cwd: string): boolean {
  return PYTHON_PROJECT_MARKERS.some((m) => fs.existsSync(path.join(cwd, m)));
}

/**
 * Detect whether a uv-managed or Poetry-managed venv exists in the CWD
 * even when it hasn't been activated (VIRTUAL_ENV not set).
 */
function detectLocalVenv(cwd: string): string | null {
  // Standard .venv directory (created by venv, virtualenv, uv, or Poetry)
  const dotVenv = path.join(cwd, '.venv');
  if (fs.existsSync(dotVenv)) {
    const activateUnix = path.join(dotVenv, 'bin', 'activate');
    const activateWin  = path.join(dotVenv, 'Scripts', 'activate.bat');
    if (fs.existsSync(activateUnix) || fs.existsSync(activateWin)) {
      return dotVenv;
    }
  }
  // Some projects use 'venv' instead of '.venv'
  const venvDir = path.join(cwd, 'venv');
  if (fs.existsSync(venvDir)) {
    const activateUnix = path.join(venvDir, 'bin', 'activate');
    const activateWin  = path.join(venvDir, 'Scripts', 'activate.bat');
    if (fs.existsSync(activateUnix) || fs.existsSync(activateWin)) {
      return venvDir;
    }
  }
  return null;
}

export async function checkPythonVenv(): Promise<DiagnosticCheck> {
  const venvPath     = process.env.VIRTUAL_ENV;
  const condaEnv     = process.env.CONDA_DEFAULT_ENV;
  const condaPrefix  = process.env.CONDA_PREFIX;
  const poetryActive = process.env.POETRY_ACTIVE;
  const uvProjectEnv = process.env.UV_PROJECT_ENVIRONMENT;
  const cwd          = process.cwd();

  // ── Active environments ───────────────────────────────────────

  if (venvPath) {
    return {
      name: 'python-venv',
      label: 'Virtual Environment',
      status: 'pass',
      message: `Active virtualenv: ${venvPath}`,
      detail:
        'A Python virtual environment is active (VIRTUAL_ENV is set). Virtual environments ' +
        'isolate project dependencies so packages installed for one project do not conflict ' +
        "with another project's packages or the system Python.",
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
        'virtualenvs and also manage non-Python dependencies like BLAS and CUDA libraries.',
      dependsOn: ['python-installation'],
    };
  }

  if (poetryActive === '1') {
    return {
      name: 'python-venv',
      label: 'Virtual Environment',
      status: 'pass',
      message: 'Poetry environment is active (POETRY_ACTIVE=1).',
      detail:
        'Poetry is managing your virtual environment. Poetry automatically creates and ' +
        'activates an isolated environment when you run commands through `poetry run` or ' +
        '`poetry shell`.',
      dependsOn: ['python-installation'],
    };
  }

  if (uvProjectEnv) {
    return {
      name: 'python-venv',
      label: 'Virtual Environment',
      status: 'pass',
      message: `uv environment active: ${uvProjectEnv}`,
      detail:
        'A uv-managed project environment is active. uv creates isolated environments ' +
        'automatically when syncing or running project commands.',
      dependsOn: ['python-installation'],
    };
  }

  // ── Local venv exists but not activated ──────────────────────
  // This is common when: IDE auto-activates, Poetry/uv manages the env,
  // or the user simply forgot to activate. Treat as pass with a note.

  const localVenv = detectLocalVenv(cwd);
  if (localVenv) {
    const isWindows = process.platform === 'win32';
    return {
      name: 'python-venv',
      label: 'Virtual Environment',
      status: 'pass',
      message: `Virtual environment directory found at: ${path.relative(cwd, localVenv) || localVenv}`,
      detail:
        `A ".venv" directory with activation scripts exists in the current directory. ` +
        `It is not currently activated in this shell session, but tools like VS Code, ` +
        `PyCharm, and uv may activate it automatically when running commands.\n\n` +
        `To activate it manually:\n` +
        (isWindows
          ? `  .venv\\Scripts\\activate   (PowerShell / CMD)`
          : `  source .venv/bin/activate`),
      dependsOn: ['python-installation'],
    };
  }

  // ── No environment — only warn if this is actually a Python project ──

  if (!isPythonProject(cwd)) {
    return {
      name: 'python-venv',
      label: 'Virtual Environment',
      status: 'pass',
      message: 'No Python project detected in current directory — venv check skipped.',
      detail:
        'No Python project markers (requirements.txt, pyproject.toml, etc.) were found ' +
        'in the current directory. The virtual environment check is only meaningful ' +
        'inside a Python project.',
      dependsOn: ['python-installation'],
    };
  }

  return {
    name: 'python-venv',
    label: 'Virtual Environment',
    status: 'warn',
    message: 'No active Python virtual environment detected.',
    detail:
      'A Python project was detected in this directory but no active virtual environment ' +
      'was found. Working without a virtual environment means pip packages are installed ' +
      'globally, which can cause version conflicts between projects and pollute the system ' +
      'Python installation.',
    suggestion:
      'Create and activate a virtual environment for your project:\n' +
      '  python3 -m venv .venv\n' +
      '  source .venv/bin/activate     (macOS/Linux)\n' +
      '  .venv\\Scripts\\activate        (Windows PowerShell)\n\n' +
      'Alternatively, use a modern tool that manages environments automatically:\n' +
      '  uv sync                       (uv — fast, modern)\n' +
      '  poetry install                (Poetry)\n' +
      '  pipenv install                (Pipenv)',
    dependsOn: ['python-installation'],
  };
}
