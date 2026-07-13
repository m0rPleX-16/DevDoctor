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
    description: 'The current user\'s home directory. Many tools store configuration files here.',
    important: true,
  },
  {
    name: 'USERPROFILE',
    category: 'system',
    description: 'Windows equivalent of HOME. Points to the user\'s profile directory (e.g., C:\\Users\\username).',
    important: true,
  },
  {
    name: 'TEMP',
    category: 'system',
    description: 'Directory for temporary files. Applications use this for caches and transient data.',
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
    description: 'The default shell program (e.g., /bin/bash, /bin/zsh). Determines how commands are interpreted.',
    important: false,
  },
  {
    name: 'TERM',
    category: 'system',
    description: 'The terminal type. Affects how colors and formatting are rendered in the terminal.',
    important: false,
  },
  {
    name: 'LANG',
    category: 'system',
    description: 'System locale setting. Affects date formats, number formats, and character encoding.',
    important: false,
  },
  {
    name: 'EDITOR',
    category: 'system',
    description: 'The default text editor. Used by Git for commit messages and other tools that need a text editor.',
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
      'Tells Node.js applications whether they\'re running in development or production mode. ' +
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
    description: 'Command-line flags that are automatically passed to the Node.js runtime (e.g., --max-old-space-size).',
    important: false,
  },
  {
    name: 'NPM_CONFIG_PREFIX',
    category: 'node',
    description: 'Where npm installs global packages. Change this to install global packages without admin privileges.',
    important: false,
  },
  {
    name: 'NPM_TOKEN',
    category: 'node',
    description: 'Authentication token for npm registry. Used for publishing packages and accessing private registries.',
    important: false,
  },
  {
    name: 'NVM_HOME',
    category: 'node',
    description: 'Installation directory for Node Version Manager (nvm). Used to manage multiple Node.js versions.',
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
    description: 'Points to the Java Runtime Environment. Some applications look for this instead of JAVA_HOME.',
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
    description: 'Installation directory for Gradle, a modern build automation system for Java and other JVM languages.',
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
    description: 'The location of the Python standard library. Rarely set manually — usually auto-detected.',
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
    description: 'The Docker daemon socket. Usually unix:///var/run/docker.sock on Linux or npipe:////./pipe/docker_engine on Windows.',
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
    description: 'Custom SSH command for Git operations. Used to specify SSH keys or other SSH options.',
    important: false,
  },
];

/**
 * Scan the system environment and return categorized variables.
 *
 * @param includeAll - If true, include ALL environment variables, not just known dev ones
 * @returns Categorized environment variables
 */
export function scanEnvironment(includeAll: boolean = false): EnvironmentInfo {
  const env = process.env;
  const totalVarCount = Object.keys(env).length;

  // Collect known variables
  const variables: EnvVariable[] = KNOWN_VARIABLES
    .filter((def) => {
      // In "known only" mode, only show variables that are actually set
      // In "all" mode, show all known definitions
      if (includeAll) return true;
      return env[def.name] !== undefined;
    })
    .map((def) => ({
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

  return {
    variables,
    pathEntries,
    totalVarCount,
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
  const entries = pathValue.split(separator).filter(Boolean);

  return entries.map((entry, index) => {
    const normalizedPath = path.normalize(entry.trim());
    let exists = false;

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
