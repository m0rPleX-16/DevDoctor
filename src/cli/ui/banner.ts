/**
 * Banner
 *
 * The welcome banner displayed when the user runs `devdoctor` with
 * no arguments or with the `--help` flag.
 *
 * Inspired by popular CLIs like Vite, Astro, Angular CLI, and Nuxt —
 * uses figlet-style ASCII art with a gradient effect for a strong
 * first impression.
 */

import chalk from 'chalk';
import { gradient, theme } from './formatter.js';

// ── ASCII Art ────────────────────────────────────────────────────
// Generated with "Standard" figlet font, manually cleaned up.

const ASCII_ART = [
  '  ____             ____             _             ',
  ' |  _ \\  _____   _|  _ \\  ___   ___| |_ ___  _ __ ',
  ' | | | |/ _ \\ \\ / / | | |/ _ \\ / __| __/ _ \\| \'__|',
  ' | |_| |  __/\\ V /| |_| | (_) | (__| || (_) | |   ',
  ' |____/ \\___| \\_/ |____/ \\___/ \\___|\\__\\___/|_|   ',
];

// Gradient colors: cyan (#36BCF7) → purple (#7C3AED)
const GRADIENT_FROM: [number, number, number] = [54, 188, 247];
const GRADIENT_TO: [number, number, number] = [124, 58, 237];

/**
 * Display the Dev Doctor welcome banner.
 *
 * Uses figlet-style ASCII art with a cyan-to-purple gradient,
 * version info, and a clean tagline.
 */
export function showBanner(): void {
  const version = '0.1.0';

  console.log();

  // Render ASCII art with gradient
  for (const line of ASCII_ART) {
    console.log(gradient(line, GRADIENT_FROM, GRADIENT_TO));
  }

  console.log();

  // Version and tagline
  console.log(
    `  ${theme.primary.bold('Dev Doctor')}  ${theme.muted(`v${version}`)}`,
  );
  console.log(
    `  ${theme.muted('Diagnose · Explain · Repair')}`,
  );

  console.log();
  console.log(
    `  ${theme.muted('Run')} ${chalk.white('devdoctor --help')} ${theme.muted('for available commands')}`,
  );
  console.log();
}

/**
 * Display a compact banner used before command output.
 * Shows just the name and version on a single line,
 * similar to how Vite shows "VITE v5.0.0 ready in 300ms".
 */
export function showCompactBanner(): void {
  const version = '0.1.0';
  console.log();
  console.log(
    `  ${theme.primary.bold('Dev Doctor')} ${theme.muted(`v${version}`)}`,
  );
}
