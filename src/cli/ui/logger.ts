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
import { theme, hr } from './formatter.js';

export const logger = {
  /** A successful outcome — green with a checkmark */
  success(message: string): void {
    console.log(theme.success(`  ✓ ${message}`));
  },

  /** A warning that something may be wrong — yellow with a triangle */
  warn(message: string): void {
    console.log(theme.warning(`  ⚠ ${message}`));
  },

  /** An error or failure — red with an X */
  error(message: string): void {
    console.log(theme.error(`  ✗ ${message}`));
  },

  /** Informational message — cyan with a bullet */
  info(message: string): void {
    console.log(theme.primary(`  ● ${message}`));
  },

  /** Detailed/secondary information — dimmed text, indented */
  detail(message: string): void {
    console.log(theme.muted(`    ${message}`));
  },

  /** A suggestion or recommendation — magenta with a lightbulb */
  suggestion(message: string): void {
    console.log(chalk.hex('#A78BFA')(`  💡 ${message}`));
  },

  /** A styled section header with optional label */
  header(message: string): void {
    console.log();
    console.log(`  ${hr(message, 48)}`);
    console.log();
  },

  /** A horizontal divider line */
  divider(): void {
    console.log(`  ${hr(undefined, 48)}`);
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
