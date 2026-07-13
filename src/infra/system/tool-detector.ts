/**
 * Tool Detector
 *
 * Detects installed development tools by running version commands.
 *
 * What this teaches:
 * - How to programmatically detect installed software
 * - The difference between "installed" and "on the PATH"
 * - How version strings are typically formatted across tools
 * - Common patterns in CLI tool design (--version flag)
 *
 * Architecture note:
 * This lives in the Infrastructure layer because it interacts with
 * the OS via the command runner. The types it returns (DetectedTool)
 * are defined in the Core layer.
 */

import type { DetectedTool } from '../../core/types/doctor-result.js';
import { runCommand } from '../os/command-runner.js';

/**
 * Definition of a tool to detect.
 * This is the internal configuration — not exposed to callers.
 */
interface ToolDefinition {
  name: string;
  command: string;
  args: string[];
  category: DetectedTool['category'];
  /**
   * Extract the version string from command output.
   * Different tools format their version output differently.
   */
  parseVersion: (stdout: string) => string | undefined;
}

/**
 * Extract a version-like pattern from text.
 * Matches patterns like: v1.2.3, 1.2.3, 20.11.0, etc.
 */
function extractVersion(text: string): string | undefined {
  const match = text.match(/v?(\d+\.\d+[\w.-]*)/);
  return match ? match[1] : undefined;
}

/**
 * The list of tools Dev Doctor can detect.
 *
 * Each entry defines:
 * - What command to run
 * - How to parse the version from output
 * - What category it belongs to
 */
const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'Node.js',
    command: 'node',
    args: ['--version'],
    category: 'runtime',
    parseVersion: (stdout) => {
      // node --version outputs: v20.11.0
      return stdout.replace(/^v/, '').trim() || undefined;
    },
  },
  {
    name: 'npm',
    command: 'npm',
    args: ['--version'],
    category: 'package-manager',
    parseVersion: (stdout) => stdout.trim() || undefined,
  },
  {
    name: 'Git',
    command: 'git',
    args: ['--version'],
    category: 'version-control',
    parseVersion: (stdout) => {
      // git --version outputs: git version 2.43.0.windows.1
      return extractVersion(stdout);
    },
  },
  {
    name: 'Docker',
    command: 'docker',
    args: ['--version'],
    category: 'container',
    parseVersion: (stdout) => {
      // Docker version 24.0.7, build afdd53b
      return extractVersion(stdout);
    },
  },
  {
    name: 'Python',
    command: 'python',
    args: ['--version'],
    category: 'runtime',
    parseVersion: (stdout) => {
      // Python 3.12.0
      return extractVersion(stdout);
    },
  },
  {
    name: 'Java',
    command: 'java',
    args: ['-version'],
    category: 'runtime',
    parseVersion: (stdout) => {
      // java -version outputs to stderr: java version "17.0.9" or openjdk version "21.0.1"
      // We check both stdout and the extracted text
      return extractVersion(stdout);
    },
  },
  {
    name: 'TypeScript',
    command: 'tsc',
    args: ['--version'],
    category: 'build-tool',
    parseVersion: (stdout) => {
      // Version 5.3.3
      return extractVersion(stdout);
    },
  },
  {
    name: 'pnpm',
    command: 'pnpm',
    args: ['--version'],
    category: 'package-manager',
    parseVersion: (stdout) => stdout.trim() || undefined,
  },
  {
    name: 'Yarn',
    command: 'yarn',
    args: ['--version'],
    category: 'package-manager',
    parseVersion: (stdout) => stdout.trim() || undefined,
  },
];

/**
 * Detect a single tool.
 */
async function detectTool(def: ToolDefinition): Promise<DetectedTool> {
  const result = await runCommand(def.command, def.args, { timeoutMs: 5000 });

  if (!result.success) {
    // For Java, version info is often on stderr
    if (def.command === 'java' && result.stderr) {
      const version = def.parseVersion(result.stderr);
      if (version) {
        // Java was found, it just writes to stderr
        const pathResult = await runCommand(
          process.platform === 'win32' ? 'where' : 'which',
          [def.command],
          { timeoutMs: 3000 },
        );

        return {
          name: def.name,
          command: def.command,
          version,
          path: pathResult.success ? pathResult.stdout.split('\n')[0].trim() : undefined,
          installed: true,
          category: def.category,
        };
      }
    }

    return {
      name: def.name,
      command: def.command,
      version: undefined,
      path: undefined,
      installed: false,
      category: def.category,
    };
  }

  const version = def.parseVersion(result.stdout);

  // Get the installation path
  const pathResult = await runCommand(
    process.platform === 'win32' ? 'where' : 'which',
    [def.command],
    { timeoutMs: 3000 },
  );

  return {
    name: def.name,
    command: def.command,
    version,
    path: pathResult.success ? pathResult.stdout.split('\n')[0].trim() : undefined,
    installed: true,
    category: def.category,
  };
}

/**
 * Detect all configured development tools.
 *
 * Runs tool detection concurrently for speed — each tool detection
 * is independent, so there's no reason to run them sequentially.
 *
 * @returns Array of DetectedTool objects for all configured tools
 */
export async function detectTools(): Promise<DetectedTool[]> {
  const results = await Promise.all(TOOL_DEFINITIONS.map(detectTool));

  // Sort: installed tools first, then by category, then by name
  return results.sort((a, b) => {
    if (a.installed !== b.installed) return a.installed ? -1 : 1;
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return a.name.localeCompare(b.name);
  });
}

/**
 * Get only the installed tools.
 */
export async function detectInstalledTools(): Promise<DetectedTool[]> {
  const all = await detectTools();
  return all.filter((t) => t.installed);
}
