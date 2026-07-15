/**
 * Interactive Mode
 *
 * Presents an arrow-key menu when `devdoctor` is run with no arguments
 * in an interactive terminal (TTY). Non-TTY environments (pipes, CI)
 * fall back to the standard help output.
 *
 * Implementation uses Node's built-in readline — no extra dependencies.
 * The menu captures raw keypress events, renders a selection list, and
 * returns the chosen command string for Commander to dispatch.
 *
 * 0.3.1:
 * - Secondary prompts surface key flags (--verbose, --dry-run, --yes,
 *   --format, --all, --path) without requiring the user to know CLI syntax.
 * - Main menu footer shows a --help tip for advanced/power users.
 */

import readline from 'node:readline';
import { theme } from './formatter.js';
import chalk from 'chalk';

// ── Menu items ────────────────────────────────────────────────────

interface MenuItem {
  icon: string;
  label: string;
  description: string;
  /** The CLI args to run when this item is selected */
  args: string[];
}

function buildMenuItems(pluginNames: string[]): MenuItem[] {
  const pluginList = pluginNames.join(', ');
  return [
    {
      icon: theme.success('❖'),
      label: 'Full health check',
      description: 'doctor — runs all plugins and shows a health dashboard',
      args: ['doctor'],
    },
    {
      icon: theme.primary('⌕'),
      label: 'Diagnose a plugin',
      description: `diagnose — choose from: ${pluginList}`,
      args: ['diagnose'],
    },
    {
      icon: theme.warning('⚒'),
      label: 'Fix issues',
      description: `fix — choose from: ${pluginList}`,
      args: ['fix'],
    },
    {
      icon: theme.accent('ℹ'),
      label: 'System info',
      description: 'info — OS, CPU, memory, runtime, detected tools',
      args: ['info'],
    },
    {
      icon: theme.accent('☰'),
      label: 'Environment variables',
      description: 'env — PATH breakdown and security check',
      args: ['env'],
    },
    {
      icon: theme.accent('⧉'),
      label: 'Health history',
      description: 'history — view timeline of past health check scores',
      args: ['history'],
    },
    {
      icon: theme.highlight('↺'),
      label: 'Roll back a repair',
      description: 'rollback — undo the last session or a specific repair',
      args: ['rollback'],
    },
    {
      icon: theme.secondary('⚙'),
      label: 'Configuration',
      description: 'config — init, show, or inspect config file paths',
      args: ['config'],
    },
    {
      icon: theme.muted('◇'),
      label: 'Clean state files',
      description: 'clean — remove snapshot, history, audit log, or lock file',
      args: ['clean'],
    },
    {
      icon: theme.accent('⇥'),
      label: 'Shell completions',
      description: 'completion — generate shell tab-completion scripts',
      args: ['completion'],
    },
    {
      icon: theme.error('×'),
      label: 'Exit',
      description: 'exit — quit the interactive Dev Doctor CLI',
      args: ['exit'],
    },
  ];
}

// ── Rendering ─────────────────────────────────────────────────────

function renderMenu(items: MenuItem[], selected: number): void {
  // Move cursor up by the number of lines we previously rendered, if any
  process.stdout.write('\x1B[?25l'); // Hide cursor while rendering

  const lines: string[] = [];
  lines.push(`  ${theme.muted('Use ↑ ↓ arrows to navigate, Enter to select, Esc/q to exit.')}`);
  lines.push('');

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const isSelected = i === selected;

    const cursor = isSelected ? chalk.hex('#36BCF7')('❯') : theme.muted(' ');

    const icon = item.icon;
    const label = isSelected ? chalk.hex('#36BCF7').bold(item.label) : chalk.white(item.label);

    const desc = isSelected ? theme.muted(`  ${item.description}`) : '';

    lines.push(`  ${cursor}  ${icon}  ${label}`);
    if (desc) lines.push(`        ${desc}`);
  }

  lines.push('');
  lines.push(
    `  ${theme.muted('Tip: Run')} ${chalk.white('devdoctor --help')} ${theme.muted('or')} ${chalk.white('devdoctor <command> --help')} ${theme.muted('for advanced flags.')}`,
  );
  lines.push('');

  process.stdout.write(lines.join('\n') + '\n');
}

function clearLines(count: number): void {
  for (let i = 0; i < count; i++) {
    process.stdout.write('\x1B[1A\x1B[2K'); // Move up + clear line
  }
}

function lineCount(items: MenuItem[], selected: number): number {
  // renderMenu writes:
  //   1  header line
  //   1  blank
  //   N  one line per item
  //   1  description line for the selected item (always emitted)
  //   1  blank
  //   1  tip line
  //   1  trailing blank (from the final \n after lines.join('\n'))
  // Total = items.length + 6, which matches what process.stdout.write outputs.
  // The selected param is unused but kept for API compatibility.
  void selected;
  return items.length + 6;
}

// ── Plugin sub-menu ───────────────────────────────────────────────

/** Prompt user to pick a plugin from a simple numbered list. Returns null if aborted. */
async function pickPlugin(pluginNames: string[], verb: string): Promise<string | null> {
  return new Promise((resolve) => {
    process.stdout.write('\n');
    process.stdout.write(`  ${theme.muted(`Which plugin would you like to ${verb}?`)}\n\n`);

    pluginNames.forEach((name, i) => {
      process.stdout.write(`    ${theme.primary(`${i + 1}.`)}  ${chalk.white(name)}\n`);
    });

    process.stdout.write('\n');
    process.stdout.write(`  ${theme.muted('Enter number (or press Esc to go back): ')}`);

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false,
    });

    process.stdin.setRawMode(true);
    process.stdin.resume();

    let buf = '';

    const onKey = (chunk: Buffer) => {
      const key = chunk.toString();

      // Ctrl+C
      if (key === '\u0003') {
        cleanup();
        process.exit(0);
      }

      // Esc
      if (key === '\x1B') {
        cleanup();
        process.stdout.write('\n');
        resolve(null);
        return;
      }

      // Enter
      if (key === '\r' || key === '\n') {
        const idx = parseInt(buf, 10) - 1;
        cleanup();
        process.stdout.write('\n');
        if (idx >= 0 && idx < pluginNames.length) {
          resolve(pluginNames[idx]);
        } else {
          resolve(null);
        }
        return;
      }

      // Backspace
      if (key === '\x7F' || key === '\b') {
        buf = buf.slice(0, -1);
        process.stdout.write('\b \b');
        return;
      }

      // Digit
      if (/^\d$/.test(key)) {
        buf += key;
        process.stdout.write(key);
      }
    };

    function cleanup() {
      process.stdin.removeListener('data', onKey);
      process.stdin.setRawMode(false);
      rl.close();
    }

    process.stdin.on('data', onKey);
  });
}

// ── Secondary option prompts ──────────────────────────────────────

/**
 * Ask a simple yes/no question in raw-mode stdin.
 * Returns true for y/Y, false for n/N or Enter (default no).
 * Esc aborts and returns null (signals "go back").
 */
async function askYesNo(question: string): Promise<boolean | null> {
  return new Promise((resolve) => {
    process.stdout.write(
      `  ${theme.primary('›')}  ${chalk.white(question)} ${theme.muted('(y/N): ')}`,
    );

    process.stdin.setRawMode(true);
    process.stdin.resume();

    const onKey = (chunk: Buffer) => {
      const key = chunk.toString();
      process.stdin.removeListener('data', onKey);
      process.stdin.setRawMode(false);

      if (key === '\u0003') {
        process.exit(0);
      }

      if (key === '\x1B') {
        process.stdout.write('\n');
        resolve(null);
      } else if (key === 'y' || key === 'Y') {
        process.stdout.write(`${chalk.green('y')}\n`);
        resolve(true);
      } else {
        process.stdout.write(`${theme.muted('n')}\n`);
        resolve(false);
      }
    };

    process.stdin.on('data', onKey);
  });
}

/**
 * Ask the user to pick from a short list of labelled options using number keys.
 * Returns the chosen value string, or null if Esc was pressed.
 */
async function askChoice(
  question: string,
  choices: Array<{ key: string; label: string; value: string }>,
): Promise<string | null> {
  return new Promise((resolve) => {
    process.stdout.write(`\n  ${theme.primary('›')}  ${chalk.white(question)}\n\n`);
    for (const c of choices) {
      process.stdout.write(`      ${theme.primary(c.key + '.')}  ${chalk.white(c.label)}\n`);
    }
    process.stdout.write(`\n  ${theme.muted('Enter number (or press Esc to skip): ')}`);

    process.stdin.setRawMode(true);
    process.stdin.resume();

    const onKey = (chunk: Buffer) => {
      const key = chunk.toString();
      process.stdin.removeListener('data', onKey);
      process.stdin.setRawMode(false);

      if (key === '\u0003') {
        process.exit(0);
      }

      if (key === '\x1B') {
        process.stdout.write('\n');
        resolve(null);
        return;
      }

      const match = choices.find((c) => c.key === key);
      if (match) {
        process.stdout.write(`${chalk.green(key)}\n`);
        resolve(match.value);
      } else {
        process.stdout.write(`${theme.muted(key)}\n`);
        resolve(null);
      }
    };

    process.stdin.on('data', onKey);
  });
}

/**
 * Gather interactive options for the `diagnose` command.
 * Returns extra argv flags to append.
 */
async function askDiagnoseOptions(): Promise<string[]> {
  process.stdout.write('\n');
  const verbose = await askYesNo('Show verbose output for all checks?');
  const flags: string[] = [];
  if (verbose === true) flags.push('--verbose');
  return flags;
}

/**
 * Gather interactive options for the `fix` command.
 * Returns extra argv flags to append.
 */
async function askFixOptions(): Promise<string[]> {
  process.stdout.write('\n');
  const dryRun = await askYesNo('Preview repairs without making changes? (dry run)');
  if (dryRun === true) return ['--dry-run'];

  const autoConfirm = await askYesNo('Auto-confirm all repairs without prompting? (--yes)');
  const flags: string[] = [];
  if (autoConfirm === true) flags.push('--yes');
  return flags;
}

/**
 * Gather interactive options for the `doctor` command.
 * Returns extra argv flags to append.
 */
async function askDoctorOptions(): Promise<string[]> {
  const format = await askChoice('Output format?', [
    { key: '1', label: 'terminal  — colour dashboard (default)', value: 'terminal' },
    { key: '2', label: 'json      — machine-readable JSON', value: 'json' },
    { key: '3', label: 'markdown  — GitHub-Flavoured Markdown', value: 'markdown' },
  ]);
  if (!format || format === 'terminal') return [];
  return ['--format', format];
}

/**
 * Gather interactive options for the `info` command.
 * Returns extra argv flags to append.
 */
async function askInfoOptions(): Promise<string[]> {
  const format = await askChoice('Output format?', [
    { key: '1', label: 'terminal  — styled display (default)', value: 'terminal' },
    { key: '2', label: 'json      — machine-readable JSON', value: 'json' },
  ]);
  if (!format || format === 'terminal') return [];
  return ['--format', format];
}

/**
 * Gather interactive options for the `env` command.
 * Returns extra argv flags to append.
 */
async function askEnvOptions(): Promise<string[]> {
  process.stdout.write('\n');
  const pathOnly = await askYesNo('Show only the PATH breakdown?');
  if (pathOnly === true) return ['--path'];

  const all = await askYesNo('Show ALL environment variables (not just dev-relevant)?');
  const flags: string[] = [];
  if (all === true) flags.push('--all');
  return flags;
}

/**
 * Gather interactive options for the `history` command.
 * Returns extra argv flags to append.
 */
async function askHistoryOptions(): Promise<string[]> {
  const count = await askChoice('How many recent runs would you like to see?', [
    { key: '1', label: 'Last 10   (default)', value: '10' },
    { key: '2', label: 'Last 25', value: '25' },
    { key: '3', label: 'Last 50', value: '50' },
    { key: '4', label: 'Last 100', value: '100' },
  ]);
  if (!count || count === '10') return [];
  return ['--last', count];
}

/**
 * Prompt user to type a free-form check name for rollback.
 * Returns null if aborted with Esc.
 */
async function askCheckName(): Promise<string | null> {
  return new Promise((resolve) => {
    process.stdout.write(
      `\n  ${theme.muted('Enter the check name to roll back (e.g. mysql-service): ')}`,
    );

    process.stdin.setRawMode(true);
    process.stdin.resume();

    let buf = '';

    const onKey = (chunk: Buffer) => {
      const key = chunk.toString();

      if (key === '\u0003') {
        cleanup();
        process.exit(0);
      }

      if (key === '\x1B') {
        cleanup();
        process.stdout.write('\n');
        resolve(null);
        return;
      }

      if (key === '\r' || key === '\n') {
        cleanup();
        process.stdout.write('\n');
        resolve(buf.trim() || null);
        return;
      }

      if (key === '\x7F' || key === '\b') {
        buf = buf.slice(0, -1);
        process.stdout.write('\b \b');
        return;
      }

      if (key.length === 1 && key >= ' ') {
        buf += key;
        process.stdout.write(key);
      }
    };

    function cleanup() {
      process.stdin.removeListener('data', onKey);
      process.stdin.setRawMode(false);
    }

    process.stdin.on('data', onKey);
  });
}

/**
 * Known repairable + rollback-supported checks per plugin.
 * Used to guide the user in the rollback interactive flow.
 */
const ROLLBACK_SUPPORTED_CHECKS: Record<string, string[]> = {
  mysql: ['mysql-service', 'xampp-process'],
  node: ['node-permissions'],
  python: ['python-venv'],
};

/**
 * Gather plugin + check name + options for the `rollback` command.
 * Offers session rollback (no args) as the first choice, then
 * falls through to plugin/check picker for a targeted rollback.
 * Returns full argv, or null to cancel.
 */
async function askRollbackOptions(
  pluginNames: string[],
  baseArgv: string[],
): Promise<string[] | null> {
  // First ask: session rollback vs specific check
  const mode = await askChoice('What would you like to roll back?', [
    {
      key: '1',
      label: 'Last session   — undo all repairs from the last fix run',
      value: 'session',
    },
    {
      key: '2',
      label: 'Specific check — undo one repair for a particular plugin',
      value: 'specific',
    },
  ]);

  if (!mode) return null;

  if (mode === 'session') {
    process.stdout.write('\n');
    const autoConfirm = await askYesNo('Auto-confirm rollback without prompting? (--yes)');
    const flags: string[] = [];
    if (autoConfirm === true) flags.push('--yes');
    return [...baseArgv, 'rollback', ...flags];
  }

  // Specific check path
  const plugin = await pickPlugin(pluginNames, 'roll back');
  if (!plugin) return null;

  const supportedChecks = ROLLBACK_SUPPORTED_CHECKS[plugin];

  let checkName: string | null;

  if (supportedChecks && supportedChecks.length > 0) {
    checkName = await askChoice(
      `Which check to roll back for ${plugin}?`,
      supportedChecks.map((c, i) => ({ key: String(i + 1), label: c, value: c })),
    );
  } else {
    process.stdout.write(
      `\n  ${theme.muted(`Note: "${plugin}" has no known rollback-supported checks.`)}\n`,
    );
    checkName = await askCheckName();
  }

  if (!checkName) return null;

  process.stdout.write('\n');
  const autoConfirm = await askYesNo('Auto-confirm rollback without prompting? (--yes)');
  const flags: string[] = [];
  if (autoConfirm === true) flags.push('--yes');

  return [...baseArgv, 'rollback', plugin, checkName, ...flags];
}

/**
 * Gather interactive options for the `clean` command.
 * Returns the sub-command argv to dispatch, or null if the user pressed Esc.
 */
async function askCleanOptions(baseArgv: string[]): Promise<string[] | null> {
  const sub = await askChoice('What would you like to clean?', [
    { key: '1', label: 'snapshot — repair session snapshot (used by rollback)', value: 'snapshot' },
    { key: '2', label: 'history  — doctor run history (health score timeline)', value: 'history' },
    { key: '3', label: 'audit    — repair audit log', value: 'audit' },
    { key: '4', label: 'lock     — stale fix.lock file', value: 'lock' },
    { key: '5', label: 'all      — remove all of the above', value: 'all' },
  ]);
  if (!sub) return null; // Esc → return to main menu, never default to 'all'
  return [...baseArgv, 'clean', sub];
}

/**
 * Gather interactive options for the `completion` command.
 * Returns the sub-command argv to dispatch, or null if the user pressed Esc.
 */
async function askCompletionOptions(baseArgv: string[]): Promise<string[] | null> {
  const shell = await askChoice('Which shell would you like to generate completions for?', [
    { key: '1', label: 'bash — Bash shell script', value: 'bash' },
    { key: '2', label: 'zsh  — Zsh shell script', value: 'zsh' },
    { key: '3', label: 'fish — Fish shell script', value: 'fish' },
    { key: '4', label: 'pwsh — PowerShell script', value: 'pwsh' },
  ]);
  if (!shell) return null;
  return [...baseArgv, 'completion', shell];
}
async function askConfigOptions(): Promise<string[]> {
  const sub = await askChoice('What would you like to do?', [
    { key: '1', label: 'init — scaffold devdoctor.json in current directory', value: 'init' },
    { key: '2', label: 'show — display the resolved configuration', value: 'show' },
    { key: '3', label: 'path — print config file paths', value: 'path' },
  ]);
  if (!sub) return ['config', 'show']; // default to show
  return ['config', sub];
}

/**
 * Run the interactive arrow-key navigation menu.
 *
 * Returns null if the user exits without selecting (Esc / q).
 *
 * @param pluginNames - Names of all registered plugins
 * @param baseArgv    - The original process.argv slice (first two entries: node + script)
 */
export async function runInteractiveMenu(
  pluginNames: string[],
  baseArgv: string[],
): Promise<string[] | null> {
  const items = buildMenuItems(pluginNames);
  let selected = 0;
  let rendered = false;
  let renderedLineCount = 0;

  return new Promise((resolve) => {
    process.stdin.setRawMode(true);
    process.stdin.resume();

    const render = () => {
      if (rendered) {
        clearLines(renderedLineCount);
      }
      renderMenu(items, selected);
      renderedLineCount = lineCount(items, selected);
      rendered = true;
    };

    render();

    const onKey = async (chunk: Buffer) => {
      const key = chunk.toString();

      // Up arrow
      if (key === '\x1B[A') {
        selected = (selected - 1 + items.length) % items.length;
        render();
        return;
      }

      // Down arrow
      if (key === '\x1B[B') {
        selected = (selected + 1) % items.length;
        render();
        return;
      }

      // Enter
      if (key === '\r' || key === '\n') {
        process.stdin.removeListener('data', onKey);
        process.stdin.setRawMode(false);
        process.stdout.write('\x1B[?25h'); // Restore cursor

        const item = items[selected];

        // Commands that need a plugin argument
        if (item.args[0] === 'diagnose' || item.args[0] === 'fix') {
          const plugin = await pickPlugin(pluginNames, item.args[0]);
          if (!plugin) {
            // User bailed — restart menu
            process.stdin.setRawMode(true);
            rendered = false;
            render();
            process.stdin.on('data', onKey);
            return;
          }

          // Secondary option prompts
          let extraFlags: string[] = [];
          if (item.args[0] === 'diagnose') {
            extraFlags = await askDiagnoseOptions();
          } else if (item.args[0] === 'fix') {
            extraFlags = await askFixOptions();
          }

          resolve([...baseArgv, item.args[0], plugin, ...extraFlags]);
        } else if (item.args[0] === 'doctor') {
          const extraFlags = await askDoctorOptions();
          resolve([...baseArgv, 'doctor', ...extraFlags]);
        } else if (item.args[0] === 'info') {
          const extraFlags = await askInfoOptions();
          resolve([...baseArgv, 'info', ...extraFlags]);
        } else if (item.args[0] === 'env') {
          const extraFlags = await askEnvOptions();
          resolve([...baseArgv, 'env', ...extraFlags]);
        } else if (item.args[0] === 'history') {
          const extraFlags = await askHistoryOptions();
          resolve([...baseArgv, 'history', ...extraFlags]);
        } else if (item.args[0] === 'rollback') {
          const argv = await askRollbackOptions(pluginNames, baseArgv);
          if (!argv) {
            // User bailed — restart menu
            process.stdin.setRawMode(true);
            rendered = false;
            render();
            process.stdin.on('data', onKey);
            return;
          }
          resolve(argv);
        } else if (item.args[0] === 'config') {
          const subArgs = await askConfigOptions();
          resolve([...baseArgv, ...subArgs]);
        } else if (item.args[0] === 'clean') {
          const argv = await askCleanOptions(baseArgv);
          if (!argv) {
            // User bailed — restart menu
            process.stdin.setRawMode(true);
            rendered = false;
            render();
            process.stdin.on('data', onKey);
            return;
          }
          resolve(argv);
        } else if (item.args[0] === 'completion') {
          const argv = await askCompletionOptions(baseArgv);
          if (!argv) {
            // User bailed — restart menu
            process.stdin.setRawMode(true);
            rendered = false;
            render();
            process.stdin.on('data', onKey);
            return;
          }
          resolve(argv);
        } else if (item.args[0] === 'exit') {
          resolve(null);
        } else {
          resolve([...baseArgv, ...item.args]);
        }
        return;
      }

      // Ctrl+C — force exit
      if (key === '\u0003') {
        process.stdin.removeListener('data', onKey);
        process.stdin.setRawMode(false);
        process.stdout.write('\x1B[?25h'); // Restore cursor
        process.stdout.write('\n');
        process.exit(0);
      }

      // Esc or q — exit
      if (key === '\x1B' || key === 'q' || key === 'Q') {
        process.stdin.removeListener('data', onKey);
        process.stdin.setRawMode(false);
        process.stdout.write('\x1B[?25h'); // Restore cursor
        process.stdout.write('\n');
        resolve(null);
      }
    };

    process.stdin.on('data', onKey);
  });
}

/**
 * Prompt the user to press any key to return to the main menu.
 */
export async function waitReturnToMenu(): Promise<void> {
  return new Promise((resolve) => {
    process.stdout.write(`\n  ${theme.muted('Press any key to return to the main menu...')}\n`);
    process.stdin.setRawMode(true);
    process.stdin.resume();

    const onKey = (chunk: Buffer) => {
      const key = chunk.toString();
      process.stdin.removeListener('data', onKey);
      process.stdin.setRawMode(false);
      if (key === '\u0003') {
        process.exit(0);
      }
      resolve();
    };

    process.stdin.on('data', onKey);
  });
}
