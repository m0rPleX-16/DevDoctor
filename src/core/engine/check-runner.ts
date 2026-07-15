import type { DiagnosticCheck, DiagnosticTask } from '../types/diagnostic.js';

/**
 * Runs a list of diagnostic tasks while respecting their dependencies.
 *
 * This function processes tasks sequentially (or concurrently where possible,
 * though a simple sequential implementation is used here for reliability and simplicity).
 * If a task depends on another task that failed or warned (or wasn't found),
 * the dependent task is skipped automatically without executing its run() function.
 *
 * @param tasks - The list of tasks to execute
 * @returns The resolved results of all tasks
 */
export async function runDiagnosticTasks(tasks: DiagnosticTask[]): Promise<DiagnosticCheck[]> {
  const results: Record<string, DiagnosticCheck> = {};
  const completedNames = new Set<string>();
  const failedDependencyNames = new Set<string>();

  // A simple way to handle DAG execution is to loop until no more tasks can be processed.
  let remaining = [...tasks];

  while (remaining.length > 0) {
    const processable = remaining.filter((task) => {
      // A task is processable if all its dependencies are either completed or known to have failed
      if (!task.dependsOn || task.dependsOn.length === 0) return true;
      return task.dependsOn.every(
        (dep) => completedNames.has(dep) || failedDependencyNames.has(dep),
      );
    });

    if (processable.length === 0) {
      // Circular dependency or missing dependency detected
      // Mark all remaining as skipped
      for (const task of remaining) {
        results[task.name] = {
          name: task.name,
          label: task.label,
          status: 'skip',
          message: 'Skipped (dependency resolution failed)',
          detail: 'This check could not run due to missing or circular dependencies.',
        };
      }
      break;
    }

    // Process all processable tasks concurrently
    await Promise.all(
      processable.map(async (task) => {
        const dependsOn = task.dependsOn || [];

        // Did any dependency fail?
        const failedDeps = dependsOn.filter((dep) => failedDependencyNames.has(dep));

        if (failedDeps.length > 0) {
          // One or more dependencies failed, so we skip this task
          results[task.name] = {
            name: task.name,
            label: task.label,
            status: 'skip',
            message: `Skipped (depends on ${failedDeps.join(', ')})`,
          };
          failedDependencyNames.add(task.name); // Propagate failure cascade
        } else {
          // All dependencies passed, so we can run the task
          try {
            const result = await task.run();
            results[task.name] = result;

            // If the task itself failed, warn, or skipped, dependents shouldn't run.
            // Only 'pass' allows dependents to run.
            if (result.status === 'pass') {
              completedNames.add(task.name);
            } else {
              failedDependencyNames.add(task.name);
            }
          } catch (error) {
            // Uncaught error in check execution
            results[task.name] = {
              name: task.name,
              label: task.label,
              status: 'fail',
              message: `Execution failed: ${error instanceof Error ? error.message : String(error)}`,
            };
            failedDependencyNames.add(task.name);
          }
        }
      }),
    );

    // Remove processed tasks from remaining list
    const processedNames = new Set(processable.map((t) => t.name));
    remaining = remaining.filter((t) => !processedNames.has(t.name));
  }

  // Return results in the original order they were provided
  return tasks.map((task) => results[task.name]);
}
