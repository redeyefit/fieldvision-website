// Workday calculation utilities
// CRITICAL: Must match iOS implementation exactly
// iOS uses Calendar.weekday: 1=Sunday, 7=Saturday

import { addDays, format, parseISO, differenceInCalendarDays } from 'date-fns';

export type WorkWeek = 'mon-fri' | 'mon-sat';

/**
 * Check if a date is a workday based on work week setting
 * @param date - Date to check
 * @param workWeek - Work week configuration
 * @returns true if the date is a workday
 */
export function isWorkday(date: Date, workWeek: WorkWeek): boolean {
  const day = date.getDay(); // 0 = Sunday, 6 = Saturday

  if (workWeek === 'mon-sat') {
    // Mon-Sat: Skip only Sunday (0)
    return day !== 0;
  } else {
    // Mon-Fri: Skip Sunday (0) and Saturday (6)
    return day !== 0 && day !== 6;
  }
}

/**
 * Calculate end date given start date and duration in workdays
 * Duration includes the start day, so:
 * - 1 day task: ends same day as start
 * - 2 day task: ends 1 workday after start
 * @param start - Start date (must be a workday)
 * @param workdays - Number of workdays (including start day)
 * @param workWeek - Work week configuration
 * @returns End date (last day of the task)
 */
export function calculateEndDate(
  start: Date | string,
  workdays: number,
  workWeek: WorkWeek
): Date {
  const startDate = typeof start === 'string' ? parseISO(start) : start;
  let current = new Date(startDate);

  // Duration of 1 or less means same-day task
  if (workdays <= 1) {
    return current;
  }

  // We need to add (workdays - 1) more workdays after the start
  let added = 0;
  const toAdd = workdays - 1;

  while (added < toAdd) {
    current = addDays(current, 1);
    if (isWorkday(current, workWeek)) {
      added++;
    }
  }

  return current;
}

/**
 * Calculate the next workday on or after a given date
 * @param date - Starting date
 * @param workWeek - Work week configuration
 * @returns Next workday (could be same day if already a workday)
 */
export function nextWorkday(date: Date | string, workWeek: WorkWeek): Date {
  let current = typeof date === 'string' ? parseISO(date) : new Date(date);

  while (!isWorkday(current, workWeek)) {
    current = addDays(current, 1);
  }

  return current;
}

/**
 * Count workdays between two dates (inclusive of start, exclusive of end)
 * @param start - Start date
 * @param end - End date
 * @param workWeek - Work week configuration
 * @returns Number of workdays
 */
export function countWorkdays(
  start: Date | string,
  end: Date | string,
  workWeek: WorkWeek
): number {
  const startDate = typeof start === 'string' ? parseISO(start) : start;
  const endDate = typeof end === 'string' ? parseISO(end) : end;

  let count = 0;
  let current = new Date(startDate);

  while (current < endDate) {
    if (isWorkday(current, workWeek)) {
      count++;
    }
    current = addDays(current, 1);
  }

  return count;
}

/**
 * Format a date for display
 * @param date - Date to format
 * @returns Formatted string like "Mon 1/20/26"
 */
export function formatScheduleDate(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'EEE M/d/yy');
}

/**
 * Format a date for CSV export (MS Project format)
 * @param date - Date to format
 * @returns Formatted string like "Mon 1/20/26"
 */
export function formatCSVDate(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'EEE M/d/yy');
}

/**
 * Calculate duration string for CSV
 * @param days - Number of workdays
 * @returns String like "5 days"
 */
export function formatDuration(days: number): string {
  return `${days} day${days === 1 ? '' : 's'}`;
}

/**
 * Recalculate all task dates after a reorder or edit
 * This ensures dependencies and sequence are respected
 */
export function recalculateTasks<T extends {
  id: string;
  name: string;
  duration_days: number;
  depends_on: string[];
  sequence_index: number;
}>(
  tasks: T[],
  startDate: Date | string,
  workWeek: WorkWeek
): Array<T & {
  start_date: string;
  end_date: string;
}> {
  const start = typeof startDate === 'string' ? parseISO(startDate) : startDate;
  const sortedTasks = [...tasks].sort((a, b) => a.sequence_index - b.sequence_index);
  const calculatedTasks: Map<string, { start_date: Date; end_date: Date }> = new Map();

  return sortedTasks.map((task) => {
    let taskStart: Date;

    if (task.depends_on.length > 0) {
      // Find the latest end date among dependencies
      let latestEnd = start;
      for (const depId of task.depends_on) {
        const dep = calculatedTasks.get(depId);
        if (dep && dep.end_date > latestEnd) {
          latestEnd = dep.end_date;
        }
      }
      // Start the day after the latest dependency ends
      taskStart = nextWorkday(addDays(latestEnd, 1), workWeek);
    } else {
      // No dependencies - start from project start (or earliest available)
      taskStart = nextWorkday(start, workWeek);
    }

    const taskEnd = calculateEndDate(taskStart, task.duration_days, workWeek);

    calculatedTasks.set(task.id, { start_date: taskStart, end_date: taskEnd });

    return {
      ...task,
      start_date: format(taskStart, 'yyyy-MM-dd'),
      end_date: format(taskEnd, 'yyyy-MM-dd'),
    };
  });
}
