import fs from 'node:fs';
import path from 'node:path';
import { runCommand } from '../../../infra/os/command-runner.js';
import type { DiagnosticCheck } from '../../../core/types/diagnostic.js';

export async function checkJavaBuildTools(): Promise<DiagnosticCheck> {
  const cwd = process.cwd();
  const hasMaven = fs.existsSync(path.join(cwd, 'pom.xml'));
  const hasGradle =
    fs.existsSync(path.join(cwd, 'build.gradle')) ||
    fs.existsSync(path.join(cwd, 'build.gradle.kts'));

  if (!hasMaven && !hasGradle) {
    return {
      name: 'java-build-tools',
      label: 'Java Build Tools',
      status: 'pass',
      message: 'No Java build configuration files (pom.xml, build.gradle) found in root directory.',
      detail:
        'No action needed: Build tools are only evaluated when a Maven pom.xml or Gradle build file is present.',
      dependsOn: ['java-installation'],
    };
  }

  const isWindows = process.platform === 'win32';
  const warnings: string[] = [];

  if (hasMaven) {
    const hasMvnw = fs.existsSync(path.join(cwd, isWindows ? 'mvnw.cmd' : 'mvnw'));

    let hasMvnGlobal = false;
    if (!hasMvnw) {
      const globalCheck = await runCommand('mvn', ['--version']);
      hasMvnGlobal = globalCheck.success;
    }

    if (!hasMvnw && !hasMvnGlobal) {
      warnings.push(
        'Maven project detected but neither local wrapper (mvnw) nor global `mvn` command was found on the system PATH.',
      );
    }
  }

  if (hasGradle) {
    const hasGradlew = fs.existsSync(path.join(cwd, isWindows ? 'gradlew.bat' : 'gradlew'));

    let hasGradleGlobal = false;
    if (!hasGradlew) {
      const globalCheck = await runCommand('gradle', ['--version']);
      hasGradleGlobal = globalCheck.success;
    }

    if (!hasGradlew && !hasGradleGlobal) {
      warnings.push(
        'Gradle project detected but neither local wrapper (gradlew) nor global `gradle` command was found on the system PATH.',
      );
    }
  }

  if (warnings.length > 0) {
    return {
      name: 'java-build-tools',
      label: 'Java Build Tools',
      status: 'warn',
      message: 'Missing build tool commands for this Java project.',
      detail: warnings.join('\n'),
      suggestion:
        'Install the appropriate build tool (Maven/Gradle) globally, or add a standard wrapper script (mvnw/gradlew) to the root directory.',
      dependsOn: ['java-installation'],
    };
  }

  return {
    name: 'java-build-tools',
    label: 'Java Build Tools',
    status: 'pass',
    message: 'Build tools (Maven/Gradle) are configured correctly.',
    detail: 'Wrappers or global commands were successfully verified.',
    dependsOn: ['java-installation'],
  };
}
