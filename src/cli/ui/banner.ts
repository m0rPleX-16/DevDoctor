/**
 * Banner
 *
 * The welcome banner displayed when the user runs `devdoctor` with
 * no arguments or with the `--help` flag.
 *
 * Visual techniques used:
 *
 * 1. Three-stop gradient — the ASCII art interpolates through
 *    cyan → indigo → purple for visual richness.
 *
 * 2. Rounded box frame — the banner is enclosed in a ╭─╯ box whose
 *    border color is tinted to match the gradient midpoint.
 *
 * 3. Pill badge — version and status rendered as compact chips.
 *
 * ASCII art font: ANSI Shadow (figlet) — "DevDoctor"
 */

import chalk from 'chalk';
import { createRequire } from 'node:module';
import { theme } from './formatter.js';

// Read version from package.json — single source of truth
const require = createRequire(import.meta.url);
const { version: PKG_VERSION } = require('../../../package.json') as { version: string };

// ── ASCII Art ─────────────────────────────────────────────────────
// Font: ANSI Shadow (figlet) — "DevDoctor"
// All lines padded to equal width for clean box alignment.

const ART_LINES = [
  ' ██████╗ ███████╗██╗   ██╗██████╗  ██████╗  ██████╗████████╗ ██████╗ ██████╗ ',
  ' ██╔══██╗██╔════╝██║   ██║██╔══██╗██╔═══██╗██╔════╝╚══██╔══╝██╔═══██╗██╔══██╗',
  ' ██║  ██║█████╗  ██║   ██║██║  ██║██║   ██║██║        ██║   ██║   ██║██████╔╝',
  ' ██║  ██║██╔══╝  ╚██╗ ██╔╝██║  ██║██║   ██║██║        ██║   ██║   ██║██╔══██╗',
  ' ██████╔╝███████╗ ╚████╔╝ ██████╔╝╚██████╔╝╚██████╗   ██║   ╚██████╔╝██║  ██║',
  ' ╚═════╝ ╚══════╝  ╚═══╝  ╚═════╝  ╚═════╝  ╚═════╝   ╚═╝    ╚═════╝ ╚═╝  ╚═╝',
];

const ART_WIDTH = Math.max(...ART_LINES.map((l) => l.length));

// ── Gradient stops ────────────────────────────────────────────────
// Three-stop: cyan → indigo → purple
const STOP_A: [number, number, number] = [54, 188, 247]; // #36BCF7 cyan
const STOP_B: [number, number, number] = [99, 102, 241]; // #6366F1 indigo
const STOP_C: [number, number, number] = [124, 58, 237]; // #7C3AED purple

// Box border color: indigo midpoint for a "glow" look
const BORDER_COLOR = '#5B5BCA';

// ── Helpers ───────────────────────────────────────────────────────

/**
 * Three-stop horizontal gradient over a string.
 * First half blends A→B, second half blends B→C.
 */
function triGradient(text: string): string {
  const chars = [...text];
  const total = chars.length || 1;
  const mid = Math.floor(total / 2);

  return chars
    .map((ch, i) => {
      let r: number, g: number, b: number;
      if (i <= mid) {
        const t = mid > 0 ? i / mid : 0;
        r = Math.round(STOP_A[0] + (STOP_B[0] - STOP_A[0]) * t);
        g = Math.round(STOP_A[1] + (STOP_B[1] - STOP_A[1]) * t);
        b = Math.round(STOP_A[2] + (STOP_B[2] - STOP_A[2]) * t);
      } else {
        const t = total - mid > 1 ? (i - mid) / (total - mid - 1) : 1;
        r = Math.round(STOP_B[0] + (STOP_C[0] - STOP_B[0]) * t);
        g = Math.round(STOP_B[1] + (STOP_C[1] - STOP_B[1]) * t);
        b = Math.round(STOP_B[2] + (STOP_C[2] - STOP_B[2]) * t);
      }
      return chalk.rgb(r, g, b)(ch);
    })
    .join('');
}

/** Render a rounded box top: ╭───────╮ */
function boxTop(innerWidth: number): string {
  return chalk.hex(BORDER_COLOR)('╭' + '─'.repeat(innerWidth) + '╮');
}

/** Render a rounded box bottom: ╰───────╯ */
function boxBottom(innerWidth: number): string {
  return chalk.hex(BORDER_COLOR)('╰' + '─'.repeat(innerWidth) + '╯');
}

/** Render a box side row: │ <content padded to innerWidth> │ */
function boxRow(content: string, innerWidth: number, rawLength: number): string {
  const padding = Math.max(innerWidth - rawLength, 0);
  return (
    chalk.hex(BORDER_COLOR)('│') + content + ' '.repeat(padding) + chalk.hex(BORDER_COLOR)('│')
  );
}

/** Render a pill badge: bg-colored label chip */
function pill(label: string, bg: string, fg = '#0D0D14'): string {
  return chalk.bgHex(bg).hex(fg).bold(` ${label} `);
}

// ── Public API ────────────────────────────────────────────────────

/**
 * Display the full Dev Doctor welcome banner with gradient ANSI Shadow
 * ASCII art, rounded box frame, and version badges.
 */
export function showBanner(): void {
  if (process.env.DEVDOCTOR_QUIET === '1') return;

  const version = PKG_VERSION;
  // Inner width = art width + 1 space of padding on each side
  const innerWidth = ART_WIDTH + 2;

  console.log();
  console.log(boxTop(innerWidth));
  console.log(boxRow('', innerWidth, 0));

  for (const line of ART_LINES) {
    const gradientContent = ' ' + triGradient(line);
    const rawLen = 1 + line.length;
    console.log(boxRow(gradientContent, innerWidth, rawLen));
  }

  console.log(boxRow('', innerWidth, 0));

  // Divider inside box
  console.log(chalk.hex(BORDER_COLOR)('├' + '─'.repeat(innerWidth) + '┤'));

  // Footer: tagline + version + platform badges
  const taglineText = 'Diagnose · Explain · Repair';
  const versionText = `v${version}`;
  const tagline = `  ${theme.muted(taglineText)}`;
  const versionBadge = pill(versionText, '#6366F1', '#E0E7FF');
  const platformBadge = pill('CLI', '#0F766E', '#CCFBF1');
  const footerContent = tagline + '   ' + versionBadge + ' ' + platformBadge;
  const footerRawLen =
    2 + taglineText.length + 3 + (1 + versionText.length + 1) + 1 + (1 + 'CLI'.length + 1);
  console.log(boxRow(footerContent, innerWidth, footerRawLen));

  // Repository Link
  const repoText = 'https://github.com/m0rPleX-16/DevDoctor';
  const repoContent = `  ${theme.muted('Repo:')} ${chalk.cyan(repoText)}`;
  const repoRawLen = 2 + 5 + 1 + repoText.length;
  console.log(boxRow(repoContent, innerWidth, repoRawLen));

  console.log(boxBottom(innerWidth));
  console.log();
}

/**
 * Compact banner shown before command output.
 *
 * Example:
 *   ╷
 *   │  ✦ Dev Doctor  v0.2.1  ·  Diagnose · Explain · Repair
 *   ╵
 */
export function showCompactBanner(): void {
  if (process.env.DEVDOCTOR_QUIET === '1') return;

  const version = PKG_VERSION;
  const border = chalk.hex(BORDER_COLOR);

  console.log();
  console.log(`  ${border('╷')}`);
  console.log(
    `  ${border('│')}  ${chalk.hex('#36BCF7').bold('✦ Dev Doctor')}` +
      `  ${chalk.hex('#6366F1').bold(`v${version}`)}` +
      `  ${theme.muted('·')}  ${theme.muted('Diagnose · Explain · Repair')}`,
  );
  console.log(`  ${border('╵')}`);
  console.log();
}
