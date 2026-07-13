/**
 * Spinner
 *
 * A thin wrapper around the `ora` library for consistent spinner usage.
 *
 * Spinners provide visual feedback during long-running operations
 * (like running diagnostic checks) so users know the app hasn't frozen.
 *
 * Why wrap ora?
 * - Consistent styling across the entire application
 * - Easy to swap out the spinner library in the future
 * - Centralized configuration (color, symbol, indent)
 */

import ora, { type Ora } from 'ora';

/**
 * Create and start a spinner with a message.
 *
 * @param text - The message to display next to the spinner
 * @returns The ora spinner instance (call .succeed(), .fail(), .stop() on it)
 *
 * @example
 * ```typescript
 * const spinner = createSpinner('Running diagnostics...');
 * // ... do work ...
 * spinner.succeed('Diagnostics complete');
 * ```
 */
export function createSpinner(text: string): Ora {
  if (process.env.DEVDOCTOR_QUIET === '1') {
    // Mock Ora instance for quiet mode
    const mockOra = {
      start: () => mockOra,
      stop: () => mockOra,
      succeed: () => mockOra,
      fail: () => mockOra,
      warn: () => mockOra,
      info: () => mockOra,
      clear: () => mockOra,
      render: () => mockOra,
      frame: () => '',
      text,
    } as unknown as Ora;
    return mockOra;
  }

  return ora({
    text,
    color: 'cyan',
    indent: 2,
  }).start();
}
