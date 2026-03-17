'use client';

import { useMemo, useCallback, useRef, useState } from 'react';
import { Task } from '@/lib/supabase/types';
import { parseISO, differenceInCalendarDays, format, addDays } from 'date-fns';

interface GanttBarsProps {
  tasks: Task[];
  selectedTaskId: string | null;
  onSelectTask: (taskId: string | null) => void;
  disabled?: boolean;
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

const ROW_HEIGHT = 36; // h-8 (32px) + mb-1 (4px)
const BAR_HEIGHT = 24; // h-6
const DEFAULT_LABEL_WIDTH = 200;
const MIN_LABEL_WIDTH = 100;
const MAX_LABEL_WIDTH = 400;

export function GanttBars({ tasks, selectedTaskId, onSelectTask, disabled }: GanttBarsProps) {
  const [containerWidth, setContainerWidth] = useState(0);
  const [labelWidth, setLabelWidth] = useState(DEFAULT_LABEL_WIDTH);
  const isDraggingRef = useRef(false);
  const observerRef = useRef<ResizeObserver | null>(null);

  // Callback ref: fires whenever the div mounts/unmounts, even after conditional renders
  const barsContainerRef = useCallback((node: HTMLDivElement | null) => {
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }
    if (node) {
      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          setContainerWidth(entry.contentRect.width);
        }
      });
      observer.observe(node);
      observerRef.current = observer;
    }
  }, []);

  // Drag-to-resize label column
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    const startX = e.clientX;
    const startWidth = labelWidth;

    const onMouseMove = (ev: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const newWidth = Math.min(MAX_LABEL_WIDTH, Math.max(MIN_LABEL_WIDTH, startWidth + ev.clientX - startX));
      setLabelWidth(newWidth);
    };

    const onMouseUp = () => {
      isDraggingRef.current = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [labelWidth]);

  // Calculate date range for the chart
  const { minDate, totalDays, dateLabels } = useMemo(() => {
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
      if (i === 0 || current.getDay() === 1) {
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

  // Pre-calculate bar positions for arrow drawing
  const barPositions = useMemo(() => {
    if (totalDays === 0) return new Map<string, { left: number; width: number; row: number }>();

    const positions = new Map<string, { left: number; width: number; row: number }>();
    tasks.forEach((task, index) => {
      const startDate = parseISO(task.start_date);
      const endDate = parseISO(task.end_date);
      const startOffset = differenceInCalendarDays(startDate, minDate);
      const duration = differenceInCalendarDays(endDate, startDate) + 1;
      const left = (startOffset / totalDays) * 100;
      const width = Math.max((duration / totalDays) * 100, 2);
      positions.set(task.id, { left, width, row: index });
    });
    return positions;
  }, [tasks, minDate, totalDays]);

  // Identify orphan tasks (no predecessors, not first task)
  const orphanTaskIds = useMemo(() => {
    const orphans = new Set<string>();
    tasks.forEach((task, index) => {
      if (index > 0 && task.depends_on.length === 0) {
        orphans.add(task.id);
      }
    });
    return orphans;
  }, [tasks]);

  // Find tasks related to the selected task
  const relatedTaskIds = useMemo(() => {
    if (!selectedTaskId) return { predecessors: new Set<string>(), successors: new Set<string>() };

    const selectedTask = tasks.find((t) => t.id === selectedTaskId);
    const predecessors = new Set<string>(selectedTask?.depends_on || []);
    const successors = new Set<string>();
    tasks.forEach((t) => {
      if (t.depends_on.includes(selectedTaskId)) {
        successors.add(t.id);
      }
    });

    return { predecessors, successors };
  }, [selectedTaskId, tasks]);

  // Handle clicking a bar — toggle selection (view-only highlighting)
  const handleBarClick = useCallback((taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    onSelectTask(selectedTaskId === taskId ? null : taskId);
  }, [selectedTaskId, onSelectTask, disabled]);

  // Clear selection when clicking background
  const handleBackgroundClick = useCallback(() => {
    if (selectedTaskId) onSelectTask(null);
  }, [selectedTaskId, onSelectTask]);

  // Generate SVG arrow paths for dependencies
  const arrows = useMemo(() => {
    if (containerWidth === 0) return [];

    const chartWidth = containerWidth - labelWidth;
    const arrowData: {
      key: string;
      path: string;
      isHighlighted: boolean;
    }[] = [];

    tasks.forEach((task) => {
      task.depends_on.forEach((depId) => {
        const from = barPositions.get(depId);
        const to = barPositions.get(task.id);
        if (!from || !to) return;

        // From: right edge of predecessor bar
        const fromX = labelWidth + ((from.left + from.width) / 100) * chartWidth;
        const fromY = 8 + from.row * ROW_HEIGHT + BAR_HEIGHT / 2; // center of bar

        // To: left edge of successor bar
        const toX = labelWidth + (to.left / 100) * chartWidth;
        const toY = 8 + to.row * ROW_HEIGHT + BAR_HEIGHT / 2;

        // Bezier curve control points
        const dx = toX - fromX;
        const dy = toY - fromY;
        const cpOffset = Math.min(Math.abs(dx) * 0.4, 40);

        let path: string;
        if (dx > 20) {
          // Normal case: successor starts after predecessor ends
          path = `M ${fromX} ${fromY} C ${fromX + cpOffset} ${fromY}, ${toX - cpOffset} ${toY}, ${toX} ${toY}`;
        } else {
          // Overlap case: route arrow around
          const midY = (fromY + toY) / 2;
          const routeX = Math.max(fromX, toX) + 20;
          path = `M ${fromX} ${fromY} L ${routeX} ${fromY} Q ${routeX + 10} ${fromY}, ${routeX + 10} ${midY} Q ${routeX + 10} ${toY}, ${routeX} ${toY} L ${toX} ${toY}`;
        }

        const isHighlighted = selectedTaskId === task.id || selectedTaskId === depId;

        arrowData.push({
          key: `${depId}-${task.id}`,
          path,
          isHighlighted,
        });
      });
    });

    return arrowData;
  }, [tasks, barPositions, containerWidth, selectedTaskId, labelWidth]);

  if (tasks.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-sm text-fv-gray-500">Gantt chart will appear here</p>
      </div>
    );
  }

  const svgHeight = tasks.length * ROW_HEIGHT + 16;

  return (
    <div className="h-full flex flex-col" onClick={handleBackgroundClick}>
      {/* Date header */}
      <div className="relative h-6 border-b border-fv-gray-700 bg-fv-gray-800/50">
        <div className="relative" style={{ marginLeft: labelWidth }}>
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
      </div>

      {/* Bars + Arrows */}
      <div className="flex-1 overflow-y-auto">
        <div className="relative min-h-full" ref={barsContainerRef}>
          {/* Resize handle */}
          <div
            onMouseDown={handleResizeStart}
            className="absolute top-0 bottom-0 w-1 cursor-col-resize hover:bg-fv-blue/50 active:bg-fv-blue z-30 group"
            style={{ left: labelWidth - 2 }}
          >
            <div className="absolute inset-y-0 left-0 w-px bg-fv-gray-700 group-hover:bg-fv-blue/50" />
          </div>

          {/* Grid lines */}
          <div className="absolute inset-0" style={{ marginLeft: labelWidth }}>
            {dateLabels.map((label, i) => (
              <div
                key={i}
                className="absolute h-full border-l border-fv-gray-800"
                style={{ left: `${label.position}%` }}
              />
            ))}
          </div>

          {/* SVG overlay for arrows */}
          {containerWidth > 0 && arrows.length > 0 && (
            <svg
              className="absolute inset-0 pointer-events-none"
              width={containerWidth}
              height={svgHeight}
              style={{ zIndex: 5 }}
            >
              <defs>
                <marker
                  id="arrowhead"
                  markerWidth="8"
                  markerHeight="6"
                  refX="8"
                  refY="3"
                  orient="auto"
                >
                  <polygon points="0 0, 8 3, 0 6" fill="#6B7280" />
                </marker>
                <marker
                  id="arrowhead-active"
                  markerWidth="8"
                  markerHeight="6"
                  refX="8"
                  refY="3"
                  orient="auto"
                >
                  <polygon points="0 0, 8 3, 0 6" fill="#3B9BD9" />
                </marker>
              </defs>
              {arrows.map((arrow) => (
                <path
                  key={arrow.key}
                  d={arrow.path}
                  fill="none"
                  stroke={arrow.isHighlighted ? '#3B9BD9' : '#4B5563'}
                  strokeWidth={arrow.isHighlighted ? 2 : 1}
                  strokeDasharray={arrow.isHighlighted ? undefined : '4 2'}
                  markerEnd={arrow.isHighlighted ? 'url(#arrowhead-active)' : 'url(#arrowhead)'}
                  opacity={selectedTaskId && !arrow.isHighlighted ? 0.2 : 0.8}
                />
              ))}
            </svg>
          )}

          {/* Task bars */}
          <div className="relative py-2">
            {tasks.map((task, index) => {
              const startDate = parseISO(task.start_date);
              const endDate = parseISO(task.end_date);

              const startOffset = differenceInCalendarDays(startDate, minDate);
              const duration = differenceInCalendarDays(endDate, startDate) + 1;

              const left = (startOffset / totalDays) * 100;
              const width = Math.max((duration / totalDays) * 100, 2);

              const color = getTradeColor(task.trade);
              const isSelected = selectedTaskId === task.id;
              const isPredecessor = relatedTaskIds.predecessors.has(task.id);
              const isSuccessor = relatedTaskIds.successors.has(task.id);
              const isRelated = isPredecessor || isSuccessor;
              const isOrphan = orphanTaskIds.has(task.id);
              const isDimmed = selectedTaskId && !isSelected && !isRelated;

              return (
                <div
                  key={task.id}
                  className="flex items-center h-8 mb-1"
                >
                  {/* Task name (truncated) */}
                  <div style={{ width: labelWidth }} className={`flex-shrink-0 px-2 text-xs truncate flex items-center gap-1 ${
                    isSelected ? 'text-fv-blue font-medium' :
                    isRelated ? 'text-fv-gray-300' :
                    isDimmed ? 'text-fv-gray-600' :
                    'text-fv-gray-400'
                  }`}>
                    {isOrphan && !selectedTaskId && (
                      <span className="text-amber-500 flex-shrink-0" title="No predecessor — possible missing link">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </span>
                    )}
                    {index + 1}. {task.name}
                  </div>

                  {/* Bar container */}
                  <div className="flex-1 relative h-6">
                    <div
                      onClick={(e) => handleBarClick(task.id, e)}
                      className={`absolute h-full rounded-sm transition-all cursor-pointer group ${
                        isSelected ? 'ring-2 ring-fv-blue ring-offset-1 ring-offset-fv-gray-900 brightness-110' :
                        isRelated ? 'brightness-110' :
                        isDimmed ? 'opacity-30' :
                        'hover:brightness-110'
                      }`}
                      style={{
                        left: `${left}%`,
                        width: `${width}%`,
                        backgroundColor: color,
                        zIndex: isSelected ? 10 : isRelated ? 8 : 1,
                      }}
                    >
                      {/* Relationship indicator badges */}
                      {isSelected && (
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-fv-blue rounded-full border border-fv-gray-900" />
                      )}
                      {isPredecessor && !isSelected && (
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border border-fv-gray-900" title="Predecessor" />
                      )}
                      {isSuccessor && !isSelected && (
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-orange-500 rounded-full border border-fv-gray-900" title="Successor" />
                      )}

                      {/* Tooltip on hover */}
                      <div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1.5 bg-fv-gray-800 text-xs text-white rounded shadow-lg whitespace-nowrap z-20 border border-fv-gray-700">
                        <div className="font-medium">{task.name}</div>
                        <div className="text-fv-gray-400">
                          {format(startDate, 'M/d')} - {format(endDate, 'M/d')} ({task.duration_days}d)
                        </div>
                        {task.depends_on.length > 0 && (
                          <div className="text-fv-gray-500 mt-0.5">
                            Depends on: {task.depends_on.map((depId) => {
                              const depIndex = tasks.findIndex((t) => t.id === depId);
                              return depIndex >= 0 ? `#${depIndex + 1}` : '';
                            }).filter(Boolean).join(', ')}
                          </div>
                        )}
                        {isOrphan && (
                          <div className="text-amber-400 mt-0.5">No predecessor linked</div>
                        )}
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
