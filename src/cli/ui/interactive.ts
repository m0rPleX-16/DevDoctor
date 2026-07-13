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
 */

import readline from 'node:readline';
import { theme, statusBadge } from './formatter.js';
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
      icon: '🩺',
      label: 'Full health check',
      description: 'doctor — runs all plugins and shows a health dashboard',
      args: ['doctor'],
    },
    {
      icon: '🔍',
      label: 'Diagnose a plugin',
      description: `diagnose — choose from: ${pluginList}`,
      args: ['diagnose'],
    },
    {
      icon: '🔧',
      label: 'Fix issues',
      description: `fix — choose from: ${pluginList}`,
      args: ['fix'],
    },
    {
      icon: 'ℹ️ ',
      label: 'System info',
      description: 'info — OS, CPU, memory, runtime, detected tools',
      args: ['info'],
    },
    {
      icon: '📋',
      label: 'Environment variables',
      description: 'env — dev vars grouped by category with PATH validation',
      args: ['env'],
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

    const cursor = isSelected
      ? chalk.hex('#36BCF7')('❯')
      : theme.muted(' ');

    const icon = item.icon;
    const label = isSelected
      ? chalk.hex('#36BCF7').bold(item.label)
      : chalk.white(item.label);

    const desc = isSelected
      ? theme.muted(`  ${item.description}`)
      : '';

    lines.push(`  ${cursor}  ${icon}  ${label}`);
    if (desc) lines.push(`        ${desc}`);
  }

  lines.push('');

  process.stdout.write(lines.join('\n') + '\n');
}

function clearLines(count: number): void {
  for (let i = 0; i < count; i++) {
    process.stdout.write('\x1B[1A\x1B[2K'); // Move up + clear line
  }
}

function lineCount(items: MenuItem[], selected: number): number {
  // header + blank + one line per item + selected description line + trailing blank
  return 2 + items.length + 1 + 1;
}

// ── Plugin sub-menu ───────────────────────────────────────────────

/** Prompt user to pick a plugin from a simple numbered list. Returns null if aborted. */
async function pickPlugin(
  pluginNames: string[],
  verb: string,
): Promise<string | null> {
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

// ── Main interactive entry point ──────────────────────────────────

/**
 * Show the interactive menu and return the argv array Commander should parse.
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
          resolve([...baseArgv, item.args[0], plugin]);
        } else {
          resolve([...baseArgv, ...item.args]);
        }
        return;
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
