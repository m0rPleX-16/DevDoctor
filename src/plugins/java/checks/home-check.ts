import fs from 'node:fs';
import path from 'node:path';
import type { DiagnosticCheck } from '../../../core/types/diagnostic.js';

export async function checkJavaHome(): Promise<DiagnosticCheck> {
  const javaHome = process.env.JAVA_HOME;

  if (!javaHome) {
    return {
      name: 'java-home',
      label: 'JAVA_HOME Environment Variable',
      status: 'warn',
      message: 'JAVA_HOME environment variable is not defined.',
      detail:
        'Many Java-based tools, application servers, and build systems (like Maven and Gradle) depend on the JAVA_HOME environment variable to locate the JDK installation directory.',
      suggestion:
        'Set the JAVA_HOME environment variable to point to the installation directory of your JDK (e.g. C:\\Program Files\\Eclipse Adoptium\\jdk-17... or /usr/lib/jvm/...).',
      dependsOn: ['java-installation'],
    };
  }

  if (!fs.existsSync(javaHome)) {
    return {
      name: 'java-home',
      label: 'JAVA_HOME Environment Variable',
      status: 'fail',
      message: `JAVA_HOME is defined but points to a non-existent directory: "${javaHome}".`,
      detail:
        'The directory specified by the JAVA_HOME environment variable does not exist. This will cause builds to fail.',
      suggestion:
        'Correct your JAVA_HOME environment variable to point to a valid installed JDK directory.',
      dependsOn: ['java-installation'],
    };
  }

  const isWindows = process.platform === 'win32';
  const javaBinary = isWindows
    ? path.join(javaHome, 'bin', 'java.exe')
    : path.join(javaHome, 'bin', 'java');

  if (!fs.existsSync(javaBinary)) {
    return {
      name: 'java-home',
      label: 'JAVA_HOME Environment Variable',
      status: 'warn',
      message: `JAVA_HOME points to "${javaHome}", but bin/java was not found.`,
      detail:
        'The JAVA_HOME directory exists, but it does not appear to contain a valid JDK or JRE installation (missing bin/java binary).',
      suggestion:
        'Ensure JAVA_HOME points to the root directory of the JDK installation (not the bin folder itself, nor an empty directory).',
      dependsOn: ['java-installation'],
    };
  }

  return {
    name: 'java-home',
    label: 'JAVA_HOME Environment Variable',
    status: 'pass',
    message: `JAVA_HOME is set to "${javaHome}" and is valid.`,
    detail: `Found Java executable inside JAVA_HOME: ${javaBinary}`,
    dependsOn: ['java-installation'],
  };
}
