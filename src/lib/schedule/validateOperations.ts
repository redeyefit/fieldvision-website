import {
  Task,
  ScheduleModificationOperation,
  ValidatedOperation,
  FieldChange,
} from '@/lib/supabase/types';

/**
 * Resolve task name to an existing task.
 * Tries exact match first, then case-insensitive.
 */
function resolveTaskByName(
  name: string,
  tasks: Task[]
): Task | null {
  // Exact match
  const exact = tasks.find((t) => t.name === name);
  if (exact) return exact;

  // Case-insensitive
  const lower = name.toLowerCase();
  const ci = tasks.find((t) => t.name.toLowerCase() === lower);
  return ci ?? null;
}

/**
 * Detect circular dependencies using DFS.
 * Returns true if adding `from -> to` would create a cycle.
 */
function wouldCreateCycle(
  from: string,
  to: string,
  adjacency: Map<string, string[]>
): boolean {
  // Check if there's a path from `to` back to `from`
  const visited = new Set<string>();
  const stack = [to];

  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current === from) return true;
    if (visited.has(current)) continue;
    visited.add(current);

    const deps = adjacency.get(current) || [];
    for (const dep of deps) {
      stack.push(dep);
    }
  }

  return false;
}

/**
 * Validate and resolve raw AI operations against existing tasks.
 * - Resolves task names to UUIDs
 * - Checks for circular dependencies
 * - Validates duration bounds
 * - Warns about dangling references
 */
export function validateAndResolveOperations(
  rawOps: ScheduleModificationOperation[],
  existingTasks: Task[]
): { operations: ValidatedOperation[]; warnings: string[]; errors: string[] } {
  const operations: ValidatedOperation[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];

  // Build a mutable task list to track adds/deletes during validation
  const tasksCopy = [...existingTasks];

  // Build adjacency map for cycle detection
  const adjacency = new Map<string, string[]>();
  for (const task of tasksCopy) {
    adjacency.set(task.id, [...task.depends_on]);
  }

  for (const op of rawOps) {
    switch (op.action) {
      case 'update': {
        const task = resolveTaskByName(op.task_name, tasksCopy);
        if (!task) {
          errors.push(`Task "${op.task_name}" not found. Available tasks: ${tasksCopy.map((t) => t.name).join(', ')}`);
          continue;
        }

        const changes: Record<string, FieldChange> = {};

        if (op.name !== undefined && op.name !== task.name) {
          changes.name = { from: task.name, to: op.name };
        }
        if (op.trade !== undefined && op.trade !== task.trade) {
          changes.trade = { from: task.trade, to: op.trade };
        }
        if (op.duration_days !== undefined && op.duration_days !== task.duration_days) {
          if (op.duration_days < 1 || op.duration_days > 120) {
            errors.push(`Duration for "${op.task_name}" must be 1-120 days (got ${op.duration_days})`);
            continue;
          }
          changes.duration_days = { from: task.duration_days, to: op.duration_days };
        }
        if (op.depends_on_names !== undefined) {
          const resolvedDeps: string[] = [];
          let depError = false;
          for (const depName of op.depends_on_names) {
            const depTask = resolveTaskByName(depName, tasksCopy);
            if (!depTask) {
              errors.push(`Dependency "${depName}" for task "${op.task_name}" not found`);
              depError = true;
              break;
            }
            // Check for circular dependency
            if (wouldCreateCycle(task.id, depTask.id, adjacency)) {
              errors.push(`Adding dependency "${depName}" to "${op.task_name}" would create a circular dependency`);
              depError = true;
              break;
            }
            resolvedDeps.push(depTask.id);
          }
          if (depError) continue;

          const currentDepNames = task.depends_on
            .map((id) => tasksCopy.find((t) => t.id === id)?.name || id)
            .sort();
          const newDepNames = op.depends_on_names.sort();
          if (JSON.stringify(currentDepNames) !== JSON.stringify(newDepNames)) {
            changes.depends_on = {
              from: currentDepNames,
              to: newDepNames,
            };
          }

          // Update adjacency for future cycle checks
          adjacency.set(task.id, resolvedDeps);
        }

        if (Object.keys(changes).length === 0) {
          warnings.push(`No changes detected for "${op.task_name}"`);
          continue;
        }

        operations.push({
          action: 'update',
          task_id: task.id,
          task_name: task.name,
          changes,
        });
        break;
      }

      case 'add': {
        // Check for duplicate name
        const existing = resolveTaskByName(op.task_name, tasksCopy);
        if (existing) {
          warnings.push(`Task "${op.task_name}" already exists — will be added with this name anyway`);
        }

        const duration = op.duration_days ?? 1;
        if (duration < 1 || duration > 120) {
          errors.push(`Duration for new task "${op.task_name}" must be 1-120 days (got ${duration})`);
          continue;
        }

        // Resolve insert_after
        let insertAfterId: string | undefined;
        if (op.insert_after) {
          const afterTask = resolveTaskByName(op.insert_after, tasksCopy);
          if (!afterTask) {
            errors.push(`Insert after task "${op.insert_after}" not found`);
            continue;
          }
          insertAfterId = afterTask.id;
        }

        // Resolve depends_on_names
        const depIds: string[] = [];
        if (op.depends_on_names) {
          for (const depName of op.depends_on_names) {
            const depTask = resolveTaskByName(depName, tasksCopy);
            if (!depTask) {
              errors.push(`Dependency "${depName}" for new task "${op.task_name}" not found`);
              continue;
            }
            depIds.push(depTask.id);
          }
        } else if (insertAfterId) {
          // Default: depend on the task we're inserting after
          depIds.push(insertAfterId);
        }

        const changes: Record<string, FieldChange> = {
          name: { from: null, to: op.name || op.task_name },
          trade: { from: null, to: op.trade || 'General' },
          duration_days: { from: null, to: duration },
        };
        if (depIds.length > 0) {
          changes.depends_on = {
            from: null,
            to: depIds.map((id) => tasksCopy.find((t) => t.id === id)?.name || id),
          };
        }

        // Create a placeholder task for future reference within this batch
        const placeholderId = crypto.randomUUID();
        tasksCopy.push({
          id: placeholderId,
          project_id: '',
          name: op.name || op.task_name,
          trade: op.trade || null,
          duration_days: duration,
          start_date: '',
          end_date: '',
          depends_on: depIds,
          sequence_index: tasksCopy.length,
          created_at: '',
          updated_at: '',
        });
        adjacency.set(placeholderId, depIds);

        operations.push({
          action: 'add',
          task_name: op.name || op.task_name,
          changes,
          warnings: insertAfterId ? [`Inserting after "${op.insert_after}"`] : undefined,
        });
        break;
      }

      case 'delete': {
        const task = resolveTaskByName(op.task_name, tasksCopy);
        if (!task) {
          errors.push(`Task "${op.task_name}" not found for deletion`);
          continue;
        }

        // Check for dangling references
        const dependents = tasksCopy.filter((t) =>
          t.depends_on.includes(task.id) && t.id !== task.id
        );
        if (dependents.length > 0) {
          const depNames = dependents.map((t) => t.name);
          warnings.push(
            `Deleting "${task.name}" will remove it as a dependency from: ${depNames.join(', ')}`
          );
        }

        operations.push({
          action: 'delete',
          task_id: task.id,
          task_name: task.name,
          changes: {
            name: { from: task.name, to: null },
            duration_days: { from: task.duration_days, to: null },
          },
        });

        // Remove from tracking
        const idx = tasksCopy.findIndex((t) => t.id === task.id);
        if (idx >= 0) tasksCopy.splice(idx, 1);
        adjacency.delete(task.id);
        // Clean up references
        for (const [key, deps] of adjacency.entries()) {
          adjacency.set(key, deps.filter((d) => d !== task.id));
        }
        break;
      }
    }
  }

  return { operations, warnings, errors };
}
