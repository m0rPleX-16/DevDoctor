/**
 * Environment Scanner
 *
 * Scans the system's environment variables, categorizes them by
 * technology, and parses the PATH variable into individual entries.
 *
 * What this teaches:
 * - What environment variables are and how they configure software
 * - How the PATH variable works and why order matters
 * - Common development environment variables and their purposes
 * - The difference between user and system environment variables
 *
 * ADR-0012: Detects common environment security risks:
 * - `.` or empty entry in PATH (privilege escalation vector)
 * - World-writable PATH entries on Unix
 * - Possible secret values in environment variables (API keys, tokens, etc.)
 *
 * Architecture note:
 * This lives in the Infrastructure layer because it reads from
 * the process environment (an OS-level concern).
 */

import fs from 'node:fs';
import path from 'node:path';
import type {
  EnvVariable,
  EnvCategory,
  PathEntry,
  EnvironmentInfo,
  EnvSecurityRisk,
} from '../../core/types/environment.js';

/**
 * Well-known environment variables with their categories and descriptions.
 *
 * This is the educational heart of the env scanner — each variable
 * has a plain-language description of what it does and why it matters.
 */
const KNOWN_VARIABLES: Array<{
  name: string;
  category: EnvCategory;
  description: string;
  important: boolean;
}> = [
  // ── System ──
  {
    name: 'PATH',
    category: 'system',
    description:
      'A list of directories the OS searches (in order) when you run a command. ' +
      'If a tool is "not found", it\'s usually because its directory isn\'t on the PATH.',
    important: true,
  },
  {
    name: 'HOME',
    category: 'system',
    description: "The current user's home directory. Many tools store configuration files here.",
    important: true,
  },
  {
    name: 'USERPROFILE',
    category: 'system',
    description:
      "Windows equivalent of HOME. Points to the user's profile directory (e.g., C:\\Users\\username).",
    important: true,
  },
  {
    name: 'TEMP',
    category: 'system',
    description:
      'Directory for temporary files. Applications use this for caches and transient data.',
    important: false,
  },
  {
    name: 'TMP',
    category: 'system',
    description: 'Alternative temporary directory variable, commonly used on Windows.',
    important: false,
  },
  {
    name: 'SHELL',
    category: 'system',
    description:
      'The default shell program (e.g., /bin/bash, /bin/zsh). Determines how commands are interpreted.',
    important: false,
  },
  {
    name: 'TERM',
    category: 'system',
    description:
      'The terminal type. Affects how colors and formatting are rendered in the terminal.',
    important: false,
  },
  {
    name: 'LANG',
    category: 'system',
    description:
      'System locale setting. Affects date formats, number formats, and character encoding.',
    important: false,
  },
  {
    name: 'EDITOR',
    category: 'system',
    description:
      'The default text editor. Used by Git for commit messages and other tools that need a text editor.',
    important: false,
  },
  {
    name: 'COMPUTERNAME',
    category: 'system',
    description: 'The network name of this computer (Windows).',
    important: false,
  },

  // ── Node.js ──
  {
    name: 'NODE_ENV',
    category: 'node',
    description:
      "Tells Node.js applications whether they're running in development or production mode. " +
      'Affects behavior like error verbosity, caching, and optimizations.',
    important: true,
  },
  {
    name: 'NODE_PATH',
    category: 'node',
    description: 'Additional directories for Node.js to search when resolving module imports.',
    important: false,
  },
  {
    name: 'NODE_OPTIONS',
    category: 'node',
    description:
      'Command-line flags that are automatically passed to the Node.js runtime (e.g., --max-old-space-size).',
    important: false,
  },
  {
    name: 'NPM_CONFIG_PREFIX',
    category: 'node',
    description:
      'Where npm installs global packages. Change this to install global packages without admin privileges.',
    important: false,
  },
  {
    name: 'NPM_TOKEN',
    category: 'node',
    description:
      'Authentication token for npm registry. Used for publishing packages and accessing private registries.',
    important: false,
  },
  {
    name: 'NVM_HOME',
    category: 'node',
    description:
      'Installation directory for Node Version Manager (nvm). Used to manage multiple Node.js versions.',
    important: false,
  },
  {
    name: 'NVM_SYMLINK',
    category: 'node',
    description: 'nvm symlink directory pointing to the active Node.js version.',
    important: false,
  },

  // ── Java ──
  {
    name: 'JAVA_HOME',
    category: 'java',
    description:
      'Points to the Java Development Kit (JDK) installation. Required by many Java tools ' +
      'like Maven, Gradle, and Android Studio to find the Java compiler and runtime.',
    important: true,
  },
  {
    name: 'JRE_HOME',
    category: 'java',
    description:
      'Points to the Java Runtime Environment. Some applications look for this instead of JAVA_HOME.',
    important: false,
  },
  {
    name: 'MAVEN_HOME',
    category: 'java',
    description: 'Installation directory for Apache Maven, a Java build automation tool.',
    important: false,
  },
  {
    name: 'GRADLE_HOME',
    category: 'java',
    description:
      'Installation directory for Gradle, a modern build automation system for Java and other JVM languages.',
    important: false,
  },

  // ── Python ──
  {
    name: 'PYTHONPATH',
    category: 'python',
    description:
      'Additional directories for Python to search when importing modules. ' +
      'Similar to NODE_PATH for Node.js.',
    important: true,
  },
  {
    name: 'PYTHONHOME',
    category: 'python',
    description:
      'The location of the Python standard library. Rarely set manually — usually auto-detected.',
    important: false,
  },
  {
    name: 'VIRTUAL_ENV',
    category: 'python',
    description:
      'Set when a Python virtual environment is active. Points to the venv directory. ' +
      'Virtual environments isolate project dependencies from the system Python.',
    important: false,
  },
  {
    name: 'CONDA_DEFAULT_ENV',
    category: 'python',
    description: 'The name of the currently active Conda environment.',
    important: false,
  },

  // ── Docker ──
  {
    name: 'DOCKER_HOST',
    category: 'docker',
    description:
      'The Docker daemon socket. Usually unix:///var/run/docker.sock on Linux or npipe:////./pipe/docker_engine on Windows.',
    important: true,
  },
  {
    name: 'DOCKER_CONFIG',
    category: 'docker',
    description: 'Directory containing Docker configuration and credentials (default: ~/.docker).',
    important: false,
  },
  {
    name: 'COMPOSE_FILE',
    category: 'docker',
    description: 'Path to the Docker Compose file to use (default: docker-compose.yml).',
    important: false,
  },

  // ── Git ──
  {
    name: 'GIT_AUTHOR_NAME',
    category: 'git',
    description: 'The name used for Git commit authoring. Overrides the value in git config.',
    important: false,
  },
  {
    name: 'GIT_AUTHOR_EMAIL',
    category: 'git',
    description: 'The email used for Git commit authoring. Overrides the value in git config.',
    important: false,
  },
  {
    name: 'GIT_SSH_COMMAND',
    category: 'git',
    description:
      'Custom SSH command for Git operations. Used to specify SSH keys or other SSH options.',
    important: false,
  },
];

// ── Security risk detection (ADR-0012) ───────────────────────────

/**
 * Variable name suffixes that commonly hold secrets.
 * Checked case-insensitively against the full variable name.
 */
const SECRET_NAME_PATTERN = /(TOKEN|SECRET|KEY|PASSWORD|API_KEY|CREDENTIAL|AUTH|PASSWD|PASS)$/i;

/**
 * Well-known non-secret values to exclude from secret detection.
 * These match the kinds of values developers legitimately set under
 * variable names like NODE_ENV, BUILD_KEY, etc.
 */
const KNOWN_SAFE_VALUES = new Set([
  'development',
  'production',
  'staging',
  'test',
  'true',
  'false',
  'yes',
  'no',
  'on',
  'off',
  '0',
  '1',
  'null',
  'undefined',
  'local',
  'localhost',
  'none',
  'default',
]);

/**
 * Determine whether a value looks like a token/secret.
 * Heuristic: long (>16 chars), mostly alphanumeric, not a known safe value.
 */
function looksLikeSecret(value: string): boolean {
  if (KNOWN_SAFE_VALUES.has(value.toLowerCase())) return false;
  if (value.length < 16) return false;
  // Must be mostly alphanumeric (tokens, JWTs, base64, hex)
  const alphanumRatio = (value.match(/[a-zA-Z0-9\-_.=+/]/g)?.length ?? 0) / value.length;
  return alphanumRatio > 0.75;
}

/**
 * Detect security risks in PATH entries.
 */
function detectPathRisks(entries: PathEntry[]): EnvSecurityRisk[] {
  const risks: EnvSecurityRisk[] = [];

  // ── `.` or empty entry in PATH ──
  const dotEntry = entries.find((e) => e.path === '.' || e.path === '');
  if (dotEntry) {
    risks.push({
      severity: 'fail',
      category: 'path',
      title: 'Current directory (.) in PATH',
      detail:
        `PATH entry #${dotEntry.index + 1} is "." (the current working directory). ` +
        'This means running any command from a directory that contains an executable ' +
        'with the same name will execute that local file instead of the system binary. ' +
        'This is a known privilege escalation and supply-chain attack vector.',
      suggestion:
        'Remove "." from PATH in your shell profile (.bashrc, .zshrc, etc.) ' +
        'or system environment variables.',
    });
  }

  // ── World-writable PATH entries (Unix only) ──
  if (process.platform !== 'win32') {
    for (const entry of entries) {
      if (!entry.exists) continue;
      try {
        const stat = fs.statSync(entry.path);
        const worldWritable = (stat.mode & 0o002) !== 0;
        if (worldWritable) {
          risks.push({
            severity: 'warn',
            category: 'path',
            title: `World-writable PATH directory: ${entry.path}`,
            detail:
              `The directory "${entry.path}" (PATH entry #${entry.index + 1}) is writable ` +
              'by any user on the system. An unprivileged attacker could plant an executable ' +
              'in this directory that shadows a system command.',
            suggestion:
              `Fix the permissions: chmod o-w "${entry.path}" ` +
              'or remove this entry from PATH if it is not needed.',
          });
        }
      } catch {
        // Stat failed (permissions, broken symlink) — skip silently
      }
    }
  }

  return risks;
}

/**
 * Detect variables whose names suggest they hold secrets and whose
 * values look like tokens or credentials.
 *
 * ADR-0012: The *value* is never included in the output — only the variable
 * name and a characterization of the value (length and pattern).
 */
function detectSecretRisks(env: NodeJS.ProcessEnv): EnvSecurityRisk[] {
  const risks: EnvSecurityRisk[] = [];

  for (const [name, value] of Object.entries(env)) {
    if (!value) continue;
    if (!SECRET_NAME_PATTERN.test(name)) continue;
    if (!looksLikeSecret(value)) continue;

    risks.push({
      severity: 'warn',
      category: 'secret',
      title: `Possible secret in environment: ${name}`,
      detail:
        `"${name}" has a name matching a common secret pattern and its value ` +
        `is ${value.length} characters long with a token-like structure. ` +
        'Secrets set as environment variables can be leaked via process listings, ' +
        'crash reports, and debug logs.',
      suggestion:
        'Store secrets in a secrets manager, .env file (excluded from git), ' +
        'or a tool like 1Password CLI / Vault rather than as persistent environment variables. ' +
        'Remove it from your shell profile if it was added there.',
    });
  }

  return risks;
}

// ── Public API ────────────────────────────────────────────────────

/**
 * Scan the system environment and return categorized variables.
 *
 * @param includeAll - If true, include ALL environment variables, not just known dev ones
 * @returns Categorized environment variables, PATH entries, and security risks
 */
export function scanEnvironment(includeAll: boolean = false): EnvironmentInfo {
  const env = process.env;
  const totalVarCount = Object.keys(env).length;

  // Collect known variables
  const variables: EnvVariable[] = KNOWN_VARIABLES.filter((def) => {
    if (includeAll) return true;
    return env[def.name] !== undefined;
  }).map((def) => ({
    name: def.name,
    value: env[def.name],
    category: def.category,
    description: def.description,
    important: def.important,
  }));

  // In "all" mode, add any env vars that weren't in the known list
  if (includeAll) {
    const knownNames = new Set(KNOWN_VARIABLES.map((d) => d.name));
    for (const [name, value] of Object.entries(env)) {
      if (!knownNames.has(name)) {
        variables.push({
          name,
          value,
          category: 'other',
          description: '',
          important: false,
        });
      }
    }
  }

  // Parse PATH entries
  const pathEntries = parsePath(env.PATH ?? env.Path ?? '');

  // Detect security risks (ADR-0012)
  const securityRisks: EnvSecurityRisk[] = [
    ...detectPathRisks(pathEntries),
    ...detectSecretRisks(env),
  ];

  return {
    variables,
    pathEntries,
    totalVarCount,
    securityRisks,
  };
}

/**
 * Parse the PATH environment variable into individual entries.
 *
 * Each entry is validated — we check whether the directory actually
 * exists on disk. Missing PATH entries are a common source of
 * "command not found" confusion.
 *
 * @param pathValue - The raw PATH string
 * @returns Parsed and validated PATH entries
 */
export function parsePath(pathValue: string): PathEntry[] {
  const separator = process.platform === 'win32' ? ';' : ':';
  // Fix #4: do NOT filter out empty strings here — an empty entry (from `;;`
  // or a leading/trailing separator) resolves to the current directory, which
  // is a security risk (ADR-0012). We keep it so detectPathRisks() can flag it.
  const entries = pathValue.split(separator);

  return entries.map((entry, index) => {
    // Trim whitespace; treat a blank entry as "." (current directory)
    const raw = entry.trim();
    const normalizedPath = raw === '' ? '.' : path.normalize(raw);
    let exists: boolean;

    try {
      exists = fs.statSync(normalizedPath).isDirectory();
    } catch {
      exists = false;
    }

    return {
      path: normalizedPath,
      index,
      exists,
    };
  });
}
