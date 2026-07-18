import fs from 'node:fs';
import path from 'node:path';
import type { DiagnosticCheck } from '../../../core/types/diagnostic.js';

export async function checkNextjsVersion(): Promise<DiagnosticCheck> {
  const cwd = process.cwd();
  const pkgJsonPath = path.join(cwd, 'package.json');

  if (!fs.existsSync(pkgJsonPath)) {
    return {
      name: 'nextjs-version',
      label: 'Next.js Version',
      status: 'fail',
      message: 'package.json not found in the current directory.',
      detail: 'Next.js projects require a package.json file to manage dependencies.',
      suggestion: 'Run `npm init` or set up a Next.js project in this directory.',
    };
  }

  let pkg;
  try {
    pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
  } catch (err) {
    return {
      name: 'nextjs-version',
      label: 'Next.js Version',
      status: 'fail',
      message: 'Failed to parse package.json.',
      detail: err instanceof Error ? err.message : String(err),
      suggestion: 'Ensure package.json is valid JSON.',
    };
  }

  const nextVersionSpec = pkg.dependencies?.next || pkg.devDependencies?.next;
  if (!nextVersionSpec) {
    return {
      name: 'nextjs-version',
      label: 'Next.js Version',
      status: 'fail',
      message: 'Next.js is not listed as a dependency in package.json.',
      detail:
        'To use Next.js diagnostics, the "next" package must be in dependencies or devDependencies.',
      suggestion: 'Install Next.js by running: npm install next react react-dom',
    };
  }

  const installedPkgPath = path.join(cwd, 'node_modules', 'next', 'package.json');
  if (!fs.existsSync(installedPkgPath)) {
    return {
      name: 'nextjs-version',
      label: 'Next.js Version',
      status: 'warn',
      message: `Next.js (${nextVersionSpec}) is listed in package.json, but node_modules/next/package.json is missing.`,
      detail: 'This usually means dependencies have not been installed yet.',
      suggestion: 'Run `npm install` or `yarn install` or `pnpm install` to install dependencies.',
    };
  }

  let installedPkg;
  try {
    installedPkg = JSON.parse(fs.readFileSync(installedPkgPath, 'utf-8'));
  } catch {
    // Fallback if we cannot parse it
  }

  const version = installedPkg?.version || nextVersionSpec.replace(/[\^~]/g, '');
  const majorMatch = version.match(/^(\d+)/);
  const major = majorMatch ? parseInt(majorMatch[1], 10) : 0;

  if (major < 13) {
    return {
      name: 'nextjs-version',
      label: 'Next.js Version',
      status: 'warn',
      message: `Next.js v${version} is installed, which is outdated.`,
      detail:
        'Next.js versions older than 13 do not support features like the App Router, automatic image optimization improvements, and the Turbopack bundler.',
      suggestion:
        'Upgrade to Next.js 13 or newer: npm install next@latest react@latest react-dom@latest',
    };
  }

  return {
    name: 'nextjs-version',
    label: 'Next.js Version',
    status: 'pass',
    message: `Next.js v${version} is installed.`,
    detail: `Next.js v${version} is active and fully functional.`,
  };
}
