/**
 * Formatter
 *
 * Terminal formatting utilities for creating polished, consistent
 * box-style layouts across all Dev Doctor commands.
 *
 * Inspired by the styling of popular CLIs like Vite, Astro, and Angular.
 * Uses Unicode box-drawing characters for clean, modern output.
 */

import chalk, { type ChalkInstance } from 'chalk';

// ── Theme Colors ──────────────────────────────────────────────────
// Centralized color palette so the entire CLI feels cohesive.

export const theme = {
  primary: chalk.hex('#36BCF7'),      // Bright cyan-blue
  secondary: chalk.hex('#7C3AED'),    // Purple accent
  success: chalk.hex('#22C55E'),      // Green
  warning: chalk.hex('#EAB308'),      // Amber
  error: chalk.hex('#EF4444'),        // Red
  muted: chalk.hex('#6B7280'),        // Gray
  text: chalk.hex('#E5E7EB'),         // Light gray text
  accent: chalk.hex('#06B6D4'),       // Teal accent
  highlight: chalk.hex('#F59E0B'),    // Gold highlight
};

// ── Gradient ──────────────────────────────────────────────────────

/**
 * Apply a horizontal gradient effect to text by interpolating
 * between two RGB colors character by character.
 */
export function gradient(
  text: string,
  from: [number, number, number],
  to: [number, number, number],
): string {
  const chars = [...text];
  const len = chars.length || 1;

  return chars
    .map((char, i) => {
      const ratio = i / (len - 1 || 1);
      const r = Math.round(from[0] + (to[0] - from[0]) * ratio);
      const g = Math.round(from[1] + (to[1] - from[1]) * ratio);
      const b = Math.round(from[2] + (to[2] - from[2]) * ratio);
      return chalk.rgb(r, g, b)(char);
    })
    .join('');
}

// ── Box Drawing ──────────────────────────────────────────────────

/**
 * Draw a horizontal rule with optional label.
 *
 * Examples:
 *   ──────────────────────────
 *   ── Node.js Diagnostics ──
 */
export function hr(label?: string, width: number = 50): string {
  if (!label) {
    return theme.muted('─'.repeat(width));
  }

  const labelText = ` ${label} `;
  const remaining = Math.max(width - labelText.length, 4);
  const left = Math.floor(remaining / 2);
  const right = remaining - left;

  return (
    theme.muted('─'.repeat(left)) +
    chalk.bold(labelText) +
    theme.muted('─'.repeat(right))
  );
}

/**
 * Render a section header with a left-aligned accent bar.
 *
 * Example:
 *   ┃ Operating System
 */
export function sectionHeader(title: string, icon?: string): string {
  const prefix = theme.primary('┃');
  const iconStr = icon ? `${icon}  ` : '';
  return `  ${prefix} ${iconStr}${chalk.bold.white(title)}`;
}

/**
 * Render a key-value field with consistent alignment.
 *
 * Example:
 *   │  Platform       Windows 11 (10.0.26200)
 */
export function field(
  label: string,
  value: string,
  labelWidth: number = 16,
): string {
  const pipe = theme.muted('│');
  const paddedLabel = theme.muted(label.padEnd(labelWidth));
  return `  ${pipe}  ${paddedLabel} ${theme.text(value)}`;
}

/**
 * Render an empty connector line for visual continuity.
 *
 * Example:
 *   │
 */
export function connector(): string {
  return `  ${theme.muted('│')}`;
}

// ── Status Rendering ─────────────────────────────────────────────

const STATUS_ICONS = {
  pass: { icon: '●', color: theme.success },
  warn: { icon: '▲', color: theme.warning },
  fail: { icon: '✖', color: theme.error },
  skip: { icon: '○', color: theme.muted },
} as const;

/**
 * Get a styled status badge.
 *
 * Example:
 *   ● PASS    ▲ WARN    ✖ FAIL    ○ SKIP
 */
export function statusBadge(
  status: 'pass' | 'warn' | 'fail' | 'skip',
): string {
  const { icon, color } = STATUS_ICONS[status];
  return color(icon);
}

/**
 * Style text based on status.
 */
export function statusColor(
  text: string,
  status: 'pass' | 'warn' | 'fail' | 'skip',
): string {
  return STATUS_ICONS[status].color(text);
}

/**
 * Render a labeled status indicator.
 *
 * Example:
 *   ● All checks passed
 *   ✖ Issues found
 */
export function statusLine(
  status: 'pass' | 'warn' | 'fail' | 'skip',
  message: string,
): string {
  return `${statusBadge(status)}  ${statusColor(message, status)}`;
}

// ── Badge / Tag ──────────────────────────────────────────────────

/**
 * Render a styled tag/badge.
 *
 * Example:
 *   PASS   WARN   FAIL
 */
export function tag(
  label: string,
  colorFn: ChalkInstance = theme.primary,
): string {
  return colorFn.bold(` ${label} `);
}

// ── Progress Bar ─────────────────────────────────────────────────

/**
 * Render a progress/usage bar.
 *
 * @param percent      - Value 0–100
 * @param width        - Bar character width (default 30)
 * @param options.showPercent - Whether to append the percentage (default true)
 * @param options.invert      - Invert the color scale: high % = green (for health scores),
 *                              low % = green (default, for resource usage like memory)
 *
 * Examples:
 *   [████████████████████░░░░░░░░░░] 67%          (default: usage bar)
 *   [████████████████████░░░░░░░░░░] 67%          (invert: health bar)
 */
export function progressBar(
  percent: number,
  width: number = 30,
  options?: { showPercent?: boolean; invert?: boolean },
): string {
  const filled = Math.round((percent / 100) * width);
  const empty = width - filled;

  let colorFn: typeof theme.success;
  if (options?.invert) {
    // Health score: high % is good
    colorFn = percent >= 80 ? theme.success : percent >= 50 ? theme.warning : theme.error;
  } else {
    // Resource usage: high % is bad
    colorFn = percent > 90 ? theme.error : percent > 70 ? theme.warning : theme.success;
  }

  const bar = colorFn('█'.repeat(filled)) + theme.muted('░'.repeat(empty));
  const percentStr = options?.showPercent !== false ? ` ${theme.text(`${percent}%`)}` : '';

  return `${theme.muted('[')}${bar}${theme.muted(']')}${percentStr}`;
}
