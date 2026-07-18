import { runCommand } from '../../../infra/os/command-runner.js';
import type { DiagnosticCheck } from '../../../core/types/diagnostic.js';

export async function checkCppCompiler(): Promise<DiagnosticCheck> {
  // Test g++
  let result = await runCommand('g++', ['--version']);
  if (result.success) {
    const versionLine = result.stdout.split('\n')[0] || 'g++';
    return {
      name: 'cpp-compiler',
      label: 'C++ Compiler Detection',
      status: 'pass',
      message: `GCC C++ compiler detected: ${versionLine}`,
      detail: 'g++ is available on the system PATH.',
    };
  }

  // Test clang++
  result = await runCommand('clang++', ['--version']);
  if (result.success) {
    const versionLine = result.stdout.split('\n')[0] || 'clang++';
    return {
      name: 'cpp-compiler',
      label: 'C++ Compiler Detection',
      status: 'pass',
      message: `Clang C++ compiler detected: ${versionLine}`,
      detail: 'clang++ is available on the system PATH.',
    };
  }

  // Test MSVC (Windows)
  if (process.platform === 'win32') {
    result = await runCommand('cl', []);
    // cl without arguments returns exit code 0 or 1 depending on version but output contains Microsoft (R) C/C++ Optimizing Compiler
    const output = result.stdout + '\n' + result.stderr;
    if (output.includes('Microsoft') && output.includes('Compiler')) {
      const versionLine = output.split('\n')[0] || 'MSVC';
      return {
        name: 'cpp-compiler',
        label: 'C++ Compiler Detection',
        status: 'pass',
        message: `MSVC C++ compiler detected: ${versionLine}`,
        detail: 'Microsoft C/C++ Compiler (cl.exe) is available in the shell environment.',
      };
    }
  }

  return {
    name: 'cpp-compiler',
    label: 'C++ Compiler Detection',
    status: 'warn',
    message: 'No supported C++ compiler (g++, clang++, or cl.exe) was found on the system PATH.',
    detail: 'C++ development requires a compiler to compile source code into executable binaries.',
    suggestion:
      process.platform === 'win32'
        ? 'Install Visual Studio with the "Desktop development with C++" workload, or install MinGW-w64 (via MSYS2) and add it to your system PATH.'
        : process.platform === 'darwin'
          ? 'Install Xcode Command Line Tools by running: xcode-select --install'
          : 'Install build-essential or clang package using your package manager (e.g. sudo apt install build-essential).',
  };
}
