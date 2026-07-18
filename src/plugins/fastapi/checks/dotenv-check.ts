import fs from 'node:fs';
import path from 'node:path';
import type { DiagnosticCheck } from '../../../core/types/diagnostic.js';

export async function checkFastapiDotenv(): Promise<DiagnosticCheck> {
  const cwd = process.cwd();
  const reqPath = path.join(cwd, 'requirements.txt');
  const pyprojPath = path.join(cwd, 'pyproject.toml');
  const envPath = path.join(cwd, '.env');

  let hasDotenvDep = false;

  if (fs.existsSync(reqPath)) {
    try {
      const content = fs.readFileSync(reqPath, 'utf-8');
      if (
        content.toLowerCase().includes('python-dotenv') ||
        content.toLowerCase().includes('pydantic-settings')
      ) {
        hasDotenvDep = true;
      }
    } catch {
      // Ignore
    }
  }

  if (!hasDotenvDep && fs.existsSync(pyprojPath)) {
    try {
      const content = fs.readFileSync(pyprojPath, 'utf-8');
      if (
        content.toLowerCase().includes('python-dotenv') ||
        content.toLowerCase().includes('pydantic-settings')
      ) {
        hasDotenvDep = true;
      }
    } catch {
      // Ignore
    }
  }

  if (hasDotenvDep && !fs.existsSync(envPath)) {
    return {
      name: 'fastapi-dotenv',
      label: 'FastAPI Environment Config',
      status: 'warn',
      message: '.env file is missing but dotenv dependencies are defined.',
      detail:
        'The project lists "python-dotenv" or "pydantic-settings" as a dependency, suggesting it reads configuration from a local `.env` file. However, no `.env` file was found in the project root directory.',
      suggestion:
        'Create a `.env` file in your root folder and configure the required application environment variables.',
    };
  }

  return {
    name: 'fastapi-dotenv',
    label: 'FastAPI Environment Config',
    status: 'pass',
    message: 'Environment configuration file checks passed.',
    detail: 'No missing environment configuration settings were detected.',
  };
}
