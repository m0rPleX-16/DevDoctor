import { runCommand } from '../../../infra/os/command-runner.js';
import type { DiagnosticCheck } from '../../../core/types/diagnostic.js';

export async function checkJavaInstallation(): Promise<DiagnosticCheck> {
  const result = await runCommand('java', ['-version']);

  if (!result.success) {
    return {
      name: 'java-installation',
      label: 'Java Runtime Installation',
      status: 'fail',
      message: 'Java is not installed or not found on the system PATH.',
      detail:
        'The Java Runtime Environment (JRE) or Java Development Kit (JDK) is required to run and build Java applications (Maven/Gradle).',
      suggestion:
        'Download and install a JDK from an OpenJDK provider (e.g. Adoptium Eclipse Temurin at https://adoptium.net or Microsoft Build of OpenJDK).',
    };
  }

  // Java outputs version details to stderr, but we combine stdout/stderr in checks
  const output = (result.stderr + '\n' + result.stdout).trim();
  const versionMatch = output.match(/(?:openjdk|java) version "([^"]+)"/i);
  const version = versionMatch ? versionMatch[1] : 'unknown version';

  return {
    name: 'java-installation',
    label: 'Java Runtime Installation',
    status: 'pass',
    message: `Java is installed (version ${version}).`,
    detail: `Resolved via: java -version\nOutput:\n${output}`,
  };
}
