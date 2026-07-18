import fs from 'node:fs';
import path from 'node:path';
import { runCommand } from '../../../infra/os/command-runner.js';
import type { DiagnosticCheck } from '../../../core/types/diagnostic.js';

export async function checkCppBuildGenerator(): Promise<DiagnosticCheck> {
  const cwd = process.cwd();
  const hasCMake = fs.existsSync(path.join(cwd, 'CMakeLists.txt'));
  const hasMakefile =
    fs.existsSync(path.join(cwd, 'Makefile')) || fs.existsSync(path.join(cwd, 'makefile'));

  const checkedTools: string[] = [];
  const missingTools: string[] = [];

  // Always check CMake if CMakeLists.txt is present
  if (hasCMake) {
    const cmakeRes = await runCommand('cmake', ['--version']);
    if (cmakeRes.success) {
      checkedTools.push(`CMake (${cmakeRes.stdout.split('\n')[0]})`);
    } else {
      missingTools.push('cmake');
    }
  }

  // Always check Make if Makefile is present
  if (hasMakefile) {
    let makeRes = await runCommand('make', ['--version']);
    if (!makeRes.success && process.platform === 'win32') {
      makeRes = await runCommand('mingw32-make', ['--version']);
    }

    if (makeRes.success) {
      checkedTools.push(`Make (${makeRes.stdout.split('\n')[0]})`);
    } else {
      missingTools.push('make');
    }
  }

  // General check: if no specific build files are in the CWD, just check if any build generator is installed
  if (!hasCMake && !hasMakefile) {
    const cmakeRes = await runCommand('cmake', ['--version']);
    const makeRes = await runCommand('make', ['--version']);
    const ninjaRes = await runCommand('ninja', ['--version']);

    if (cmakeRes.success) checkedTools.push('cmake');
    if (makeRes.success) checkedTools.push('make');
    if (ninjaRes.success) checkedTools.push('ninja');

    if (checkedTools.length === 0) {
      return {
        name: 'cpp-build-generator',
        label: 'C++ Build Generators',
        status: 'warn',
        message: 'No common C++ build generators (cmake, make, ninja) found on PATH.',
        detail:
          'C++ projects typically use a meta-build system like CMake or a build tool like Make/Ninja to manage building complex projects.',
        suggestion:
          'Install CMake (https://cmake.org) or a compiler build tool suite (e.g. make or ninja).',
      };
    }
  }

  if (missingTools.length > 0) {
    return {
      name: 'cpp-build-generator',
      label: 'C++ Build Generators',
      status: 'warn',
      message: `Required build tool(s) missing: ${missingTools.join(', ')}`,
      detail: `Your project configuration requires: ${missingTools.join(' & ')}, but they could not be found on your system PATH.`,
      suggestion: `Install the missing build tools: ${missingTools.map((t) => `${t} (e.g. via your package manager or installer)`).join(', ')}`,
    };
  }

  return {
    name: 'cpp-build-generator',
    label: 'C++ Build Generators',
    status: 'pass',
    message: `C++ build generator(s) verified: ${checkedTools.join(', ')}.`,
    detail: 'Build systems and compiler automation tools are available.',
  };
}
