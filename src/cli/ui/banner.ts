/**
 * Banner
 *
 * The welcome banner displayed when the user runs `devdoctor` with
 * no arguments or with the `--help` flag.
 *
 * A good CLI application makes a strong first impression.
 * The banner communicates the tool's identity and version,
 * and sets the tone for the user experience.
 */

import chalk from 'chalk';

/**
 * Display the Dev Doctor welcome banner.
 *
 * Uses chalk for colored, styled output with a clean ASCII design.
 */
export function showBanner(): void {
  const version = '0.1.0';

  const banner = `
${chalk.cyan.bold('  ╔══════════════════════════════════════════╗')}
${chalk.cyan.bold('  ║')}                                          ${chalk.cyan.bold('║')}
${chalk.cyan.bold('  ║')}   ${chalk.white.bold('🩺  Dev Doctor')}  ${chalk.dim(`v${version}`)}                  ${chalk.cyan.bold('║')}
${chalk.cyan.bold('  ║')}                                          ${chalk.cyan.bold('║')}
${chalk.cyan.bold('  ║')}   ${chalk.dim('Diagnose · Explain · Repair')}             ${chalk.cyan.bold('║')}
${chalk.cyan.bold('  ║')}                                          ${chalk.cyan.bold('║')}
${chalk.cyan.bold('  ╚══════════════════════════════════════════╝')}
`;

  console.log(banner);
}
