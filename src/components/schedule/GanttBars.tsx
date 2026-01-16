'use client';

import { useMemo } from 'react';
import { Task } from '@/lib/supabase/types';
import { parseISO, differenceInCalendarDays, format, addDays } from 'date-fns';

interface GanttBarsProps {
  tasks: Task[];
}

// Trade colors for visual distinction
const TRADE_COLORS: Record<string, string> = {
  'General Conditions': '#6B7280',
  'Site Work': '#92400E',
  'Concrete': '#4B5563',
  'Masonry': '#B45309',
  'Metals': '#374151',
  'Wood & Plastics': '#CA8A04',
  'Thermal & Moisture': '#059669',
  'Doors & Windows': '#0284C7',
  'Finishes': '#7C3AED',
  'Specialties': '#DB2777',
  'Equipment': '#DC2626',
  'Furnishings': '#9333EA',
  'Special Construction': '#0891B2',
  'Conveying Systems': '#475569',
  'Mechanical': '#EA580C',
  'Electrical': '#FACC15',
  'Plumbing': '#2563EB',
  'HVAC': '#16A34A',
  'Fire Protection': '#EF4444',
  'Demolition': '#EF4444',
  'Cleanup': '#22C55E',
};

function getTradeColor(trade: string | null): string {
  return TRADE_COLORS[trade || ''] || '#3B9BD9';
}

export function GanttBars({ tasks }: GanttBarsProps) {
  // Calculate date range for the chart
  const { minDate, maxDate, totalDays, dateLabels } = useMemo(() => {
    if (tasks.length === 0) {
      return { minDate: new Date(), maxDate: new Date(), totalDays: 0, dateLabels: [] };
    }

    const dates = tasks.flatMap((t) => [parseISO(t.start_date), parseISO(t.end_date)]);
    const min = new Date(Math.min(...dates.map((d) => d.getTime())));
    const max = new Date(Math.max(...dates.map((d) => d.getTime())));

    // Add padding
    const paddedMin = addDays(min, -1);
    const paddedMax = addDays(max, 2);

    const total = differenceInCalendarDays(paddedMax, paddedMin) + 1;

    // Generate date labels (show every week or so)
    const labels: { date: Date; position: number }[] = [];
    let current = new Date(paddedMin);
    let i = 0;
    while (current <= paddedMax) {
      if (i === 0 || current.getDay() === 1) { // Show first day and every Monday
        labels.push({
          date: new Date(current),
          position: (i / total) * 100,
        });
      }
      current = addDays(current, 1);
      i++;
    }

    return { minDate: paddedMin, maxDate: paddedMax, totalDays: total, dateLabels: labels };
  }, [tasks]);

  if (tasks.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-sm text-fv-gray-500">Gantt chart will appear here</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Date header */}
      <div className="relative h-6 border-b border-fv-gray-700 bg-fv-gray-800/50">
        {dateLabels.map((label, i) => (
          <div
            key={i}
            className="absolute text-xs text-fv-gray-500 whitespace-nowrap"
            style={{ left: `${label.position}%`, transform: 'translateX(-50%)' }}
          >
            {format(label.date, 'M/d')}
          </div>
        ))}
      </div>

      {/* Bars */}
      <div className="flex-1 overflow-y-auto">
        <div className="relative min-h-full">
          {/* Grid lines */}
          <div className="absolute inset-0 flex">
            {dateLabels.map((label, i) => (
              <div
                key={i}
                className="absolute h-full border-l border-fv-gray-800"
                style={{ left: `${label.position}%` }}
              />
            ))}
          </div>

          {/* Task bars */}
          <div className="relative py-2">
            {tasks.map((task, index) => {
              const startDate = parseISO(task.start_date);
              const endDate = parseISO(task.end_date);

              const startOffset = differenceInCalendarDays(startDate, minDate);
              const duration = differenceInCalendarDays(endDate, startDate) + 1;

              const left = (startOffset / totalDays) * 100;
              const width = Math.max((duration / totalDays) * 100, 2); // Minimum 2% width

              const color = getTradeColor(task.trade);

              return (
                <div
                  key={task.id}
                  className="flex items-center h-8 mb-1"
                >
                  {/* Task name (truncated) */}
                  <div className="w-32 flex-shrink-0 px-2 text-xs text-fv-gray-400 truncate">
                    {index + 1}. {task.name}
                  </div>

                  {/* Bar container */}
                  <div className="flex-1 relative h-6">
                    <div
                      className="absolute h-full rounded-sm transition-all hover:brightness-110 cursor-pointer group"
                      style={{
                        left: `${left}%`,
                        width: `${width}%`,
                        backgroundColor: color,
                      }}
                    >
                      {/* Tooltip on hover */}
                      <div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-fv-gray-800 text-xs text-white rounded shadow-lg whitespace-nowrap z-10">
                        <div className="font-medium">{task.name}</div>
                        <div className="text-fv-gray-400">
                          {format(startDate, 'M/d')} - {format(endDate, 'M/d')} ({task.duration_days}d)
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
