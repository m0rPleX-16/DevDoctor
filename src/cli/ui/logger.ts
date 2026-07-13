/**
 * Logger
 *
 * Chalk-based logging utilities for consistent, styled terminal output.
 *
 * Every message type has a distinct visual style so users can quickly
 * scan output and identify successes, warnings, errors, and info.
 *
 * Design Decision:
 * We wrap chalk in a custom logger rather than using chalk directly
 * throughout the codebase. This gives us:
 * 1. Consistent styling (single source of truth for colors)
 * 2. Easy theming changes in the future
 * 3. A single place to add features like log levels or file output
 */

import chalk from 'chalk';

export const logger = {
  /** A successful outcome — green with a checkmark */
  success(message: string): void {
    console.log(chalk.green(`  ✓ ${message}`));
  },

  /** A warning that something may be wrong — yellow with a triangle */
  warn(message: string): void {
    console.log(chalk.yellow(`  ⚠ ${message}`));
  },

  /** An error or failure — red with an X */
  error(message: string): void {
    console.log(chalk.red(`  ✗ ${message}`));
  },

  /** Informational message — cyan with a bullet */
  info(message: string): void {
    console.log(chalk.cyan(`  ● ${message}`));
  },

  /** Detailed/secondary information — dimmed text, indented */
  detail(message: string): void {
    console.log(chalk.dim(`    ${message}`));
  },

  /** A suggestion or recommendation — magenta with a lightbulb */
  suggestion(message: string): void {
    console.log(chalk.magenta(`  💡 ${message}`));
  },

  /** A styled header/title */
  header(message: string): void {
    console.log();
    console.log(chalk.bold.underline(message));
    console.log();
  },

  /** A horizontal divider line */
  divider(): void {
    console.log(chalk.dim('  ─'.repeat(25)));
  },

  /** Raw line with no styling */
  raw(message: string): void {
    console.log(message);
  },

  /** Empty line for spacing */
  newline(): void {
    console.log();
  },
};
