/**
 * Banner
 *
 * The welcome banner displayed when the user runs `devdoctor` with
 * no arguments or with the `--help` flag.
 *
 * Visual techniques used:
 *
 * 1. Drop shadow — a dark copy of the ASCII art is rendered shifted
 *    one row down and two columns right, then the gradient art is
 *    printed over it using ANSI cursor-up escapes. This creates a
 *    depth illusion without any external library.
 *
 * 2. Three-stop gradient — the ASCII art interpolates through
 *    cyan → indigo → purple for more visual richness than a simple
 *    two-color fade.
 *
 * 3. Rounded box frame — the banner is enclosed in a ╭─╯ box whose
 *    border color is tinted to match the gradient midpoint, giving
 *    the whole block a glowing-card appearance.
 *
 * 4. Pill badge — version and status are rendered as compact
 *    background-colored chips inside the box footer, matching the
 *    style used in popular CLIs like Vite and Astro.
 */

import chalk from 'chalk';
import { theme } from './formatter.js';

// ── ASCII Art ─────────────────────────────────────────────────────
// "Standard" figlet font, manually aligned.
// Each line is exactly the same width for clean shadow alignment.

const ART_LINES = [
  '  ____             ____             _              ',
  ' |  _ \\  _____   _|  _ \\  ___   ___| |_ ___  _ __ ',
  ' | | | |/ _ \\ \\ / / | | |/ _ \\ / __| __/ _ \\| \'__|',
  ' | |_| |  __/\\ V /| |_| | (_) | (__| || (_) | |   ',
  ' |____/ \\___| \\_/ |____/ \\___/ \\___|\\__\\___/|_|   ',
];

const ART_WIDTH = Math.max(...ART_LINES.map((l) => l.length));

// ── Gradient stops ────────────────────────────────────────────────
// Three-stop: cyan → indigo → purple
const STOP_A: [number, number, number] = [54, 188, 247];   // #36BCF7 cyan
const STOP_B: [number, number, number] = [99, 102, 241];   // #6366F1 indigo
const STOP_C: [number, number, number] = [124, 58, 237];   // #7C3AED purple

// Shadow color: very dark, slightly purple-tinted
const SHADOW_COLOR = '#1A1025';

// Box border color: indigo midpoint for a "glow" look
const BORDER_COLOR = '#5B5BCA';

// ── Helpers ───────────────────────────────────────────────────────

/**
 * Three-stop horizontal gradient over a string.
 * First half of characters blend A→B, second half blend B→C.
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

/**
 * Render text in the shadow color (dark, no gradient).
 * The shadow is shifted right by 2 columns via padding.
 */
function shadowLine(text: string): string {
  return chalk.hex(SHADOW_COLOR)('  ' + text);
}

/**
 * Move the terminal cursor up by N lines.
 * Used to overlay the gradient art over the already-printed shadow.
 */
function cursorUp(n: number): string {
  return `\x1b[${n}A`;
}

/** Render a rounded box top: ╭───────╮ */
function boxTop(innerWidth: number): string {
  return chalk.hex(BORDER_COLOR)(
    '  ╭' + '─'.repeat(innerWidth) + '╮',
  );
}

/** Render a rounded box bottom: ╰───────╯ */
function boxBottom(innerWidth: number): string {
  return chalk.hex(BORDER_COLOR)(
    '  ╰' + '─'.repeat(innerWidth) + '╯',
  );
}

/** Render a box side row: │ <content padded to innerWidth> │ */
function boxRow(content: string, innerWidth: number, rawLength: number): string {
  const padding = Math.max(innerWidth - rawLength, 0);
  return (
    chalk.hex(BORDER_COLOR)('  │') +
    content +
    ' '.repeat(padding) +
    chalk.hex(BORDER_COLOR)('│')
  );
}

/** Render a pill badge: bg-colored label chip */
function pill(label: string, bg: string, fg = '#0D0D14'): string {
  return chalk.bgHex(bg).hex(fg).bold(` ${label} `);
}

// ── Public API ────────────────────────────────────────────────────

/**
 * Display the full Dev Doctor welcome banner with drop shadow,
 * gradient ASCII art, rounded box frame, and version badges.
 */
export function showBanner(): void {
  const version = '0.1.0';
  // Inner width = art width + 1 leading space on each side
  const innerWidth = ART_WIDTH + 2;

  console.log();

  // ── Box top ──
  console.log(boxTop(innerWidth));

  // ── Empty row ──
  console.log(boxRow('', innerWidth, 0));

  // Step 1: print shadow lines (shifted right by 2 extra spaces inside box)
  for (const line of ART_LINES) {
    // Shadow sits 2 chars right inside the box content area
    const shadowContent = '  ' + chalk.hex(SHADOW_COLOR)(line);
    const rawLen = 2 + line.length; // leading spaces + art text
    console.log(boxRow(shadowContent, innerWidth, rawLen));
  }

  // Step 2: move cursor back up over the shadow lines
  process.stdout.write(cursorUp(ART_LINES.length));

  // Step 3: print gradient art on top, shifted left by 1 col vs shadow
  for (const line of ART_LINES) {
    const gradientContent = ' ' + triGradient(line);
    const rawLen = 1 + line.length;
    console.log(boxRow(gradientContent, innerWidth, rawLen));
  }

  // ── Empty separator row ──
  console.log(boxRow('', innerWidth, 0));

  // ── Divider inside box ──
  const divider = chalk.hex(BORDER_COLOR)('  ├' + '─'.repeat(innerWidth) + '┤');
  console.log(divider);

  // ── Footer row: tagline + badges ──
  const taglineText = 'Diagnose · Explain · Repair';
  const versionText = `v${version}`;
  const tagline = `  ${theme.muted(taglineText)}`;
  const versionBadge = pill(versionText, '#6366F1', '#E0E7FF');
  const platformBadge = pill('CLI', '#0F766E', '#CCFBF1');
  const footerContent = tagline + '   ' + versionBadge + ' ' + platformBadge;
  // Visible character count: 2 leading spaces + tagline + 3 spaces + space+text+space for each pill + 1 space between pills
  const footerRawLen = 2 + taglineText.length + 3 + (1 + versionText.length + 1) + 1 + (1 + 'CLI'.length + 1);
  console.log(boxRow(footerContent, innerWidth, footerRawLen));

  // ── Box bottom ──
  console.log(boxBottom(innerWidth));

  console.log();
  console.log(
    `  ${theme.muted('Run')} ${chalk.white('devdoctor --help')} ${theme.muted('for available commands.')}`,
  );
  console.log();
}

/**
 * Compact banner shown before command output.
 * A single styled line with a subtle separator underneath.
 *
 * Example:
 *   ╷
 *   │  ✦ Dev Doctor  v0.1.0  ·  Diagnose · Explain · Repair
 *   ╵
 */
export function showCompactBanner(): void {
  const version = '0.1.0';
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
