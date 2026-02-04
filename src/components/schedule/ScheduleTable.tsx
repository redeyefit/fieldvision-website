'use client';

import { useState, useCallback } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Task } from '@/lib/supabase/types';
import { formatScheduleDate } from '@/lib/schedule/workdays';

interface ScheduleTableProps {
  tasks: Task[];
  allTasks: Task[]; // For dependency dropdown
  onReorder: (sourceIndex: number, destIndex: number) => void;
  onUpdateTask: (taskId: string, updates: Partial<Task>) => void;
  disabled?: boolean;
}

export function ScheduleTable({ tasks, allTasks, onReorder, onUpdateTask, disabled }: ScheduleTableProps) {
  const [editingCell, setEditingCell] = useState<{ taskId: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState<string | number>('');

  const handleDragEnd = useCallback((result: DropResult) => {
    if (!result.destination || disabled) return;
    if (result.source.index === result.destination.index) return;

    onReorder(result.source.index, result.destination.index);
  }, [onReorder, disabled]);

  const handleStartEdit = useCallback((taskId: string, field: string, currentValue: string | number) => {
    if (disabled) return;
    setEditingCell({ taskId, field });
    setEditValue(currentValue);
  }, [disabled]);

  const handleSaveEdit = useCallback(() => {
    if (!editingCell) return;

    const updates: Partial<Task> = {};

    if (editingCell.field === 'name') {
      updates.name = String(editValue);
    } else if (editingCell.field === 'duration_days') {
      updates.duration_days = Math.max(1, parseInt(String(editValue)) || 1);
    } else if (editingCell.field === 'start_date') {
      updates.start_date = String(editValue);
    }

    if (Object.keys(updates).length > 0) {
      onUpdateTask(editingCell.taskId, updates);
    }

    setEditingCell(null);
    setEditValue('');
  }, [editingCell, editValue, onUpdateTask]);

  const handleCancelEdit = useCallback(() => {
    setEditingCell(null);
    setEditValue('');
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    } else if (e.key === 'Tab') {
      handleSaveEdit();
    }
  }, [handleSaveEdit, handleCancelEdit]);

  const handleDependencyChange = useCallback((taskId: string, depId: string, add: boolean) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    let newDeps: string[];
    if (add) {
      newDeps = [...task.depends_on, depId];
    } else {
      newDeps = task.depends_on.filter((d) => d !== depId);
    }

    onUpdateTask(taskId, { depends_on: newDeps });
  }, [tasks, onUpdateTask]);

  if (tasks.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <svg className="w-16 h-16 mx-auto text-fv-gray-700 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
          <h3 className="text-lg font-medium text-fv-gray-400 mb-2">No Schedule Yet</h3>
          <p className="text-sm text-fv-gray-500 max-w-xs">
            Upload a contract PDF and generate a schedule to see your tasks here
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="flex-1 min-h-0 overflow-auto">
        <table className="w-full text-sm block">
        <thead className="bg-fv-gray-800 sticky top-0 z-10">
          <tr>
            <th className="w-8 px-2 py-3 text-left text-xs font-medium text-fv-gray-400 uppercase tracking-wider">#</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-fv-gray-400 uppercase tracking-wider">Task</th>
            <th className="w-28 px-4 py-3 text-left text-xs font-medium text-fv-gray-400 uppercase tracking-wider">Trade</th>
            <th className="w-20 px-4 py-3 text-left text-xs font-medium text-fv-gray-400 uppercase tracking-wider">Days</th>
            <th className="w-28 px-4 py-3 text-left text-xs font-medium text-fv-gray-400 uppercase tracking-wider">Start</th>
            <th className="w-28 px-4 py-3 text-left text-xs font-medium text-fv-gray-400 uppercase tracking-wider">End</th>
            <th className="w-32 px-4 py-3 text-left text-xs font-medium text-fv-gray-400 uppercase tracking-wider">Depends On</th>
          </tr>
        </thead>

        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="tasks">
            {(provided) => (
              <tbody
                ref={provided.innerRef}
                {...provided.droppableProps}
                className="divide-y divide-fv-gray-800"
              >
                {tasks.map((task, index) => (
                  <Draggable key={task.id} draggableId={task.id} index={index} isDragDisabled={disabled}>
                    {(provided, snapshot) => (
                      <tr
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={`
                          ${snapshot.isDragging ? 'bg-fv-gray-700 shadow-lg' : 'bg-fv-gray-900 hover:bg-fv-gray-800'}
                        `}
                      >
                        {/* Drag handle + row number */}
                        <td
                          {...provided.dragHandleProps}
                          className="px-2 py-3 text-fv-gray-500 cursor-grab"
                        >
                          <div className="flex items-center gap-1">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M8 6h2v2H8V6zm6 0h2v2h-2V6zM8 11h2v2H8v-2zm6 0h2v2h-2v-2zM8 16h2v2H8v-2zm6 0h2v2h-2v-2z"/>
                            </svg>
                            <span className="text-xs">{index + 1}</span>
                          </div>
                        </td>

                        {/* Task name */}
                        <td className="px-4 py-3">
                          {editingCell?.taskId === task.id && editingCell.field === 'name' ? (
                            <input
                              type="text"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onBlur={handleSaveEdit}
                              onKeyDown={handleKeyDown}
                              className="w-full bg-fv-gray-800 border border-fv-blue rounded px-2 py-1 text-white focus:outline-none"
                              autoFocus
                            />
                          ) : (
                            <button
                              onClick={() => handleStartEdit(task.id, 'name', task.name)}
                              className="text-left text-white hover:text-fv-blue w-full"
                            >
                              {task.name}
                            </button>
                          )}
                        </td>

                        {/* Trade */}
                        <td className="px-4 py-3">
                          <span className="px-2 py-1 bg-fv-gray-800 text-fv-gray-300 text-xs rounded">
                            {task.trade || 'General'}
                          </span>
                        </td>

                        {/* Duration */}
                        <td className="px-4 py-3">
                          {editingCell?.taskId === task.id && editingCell.field === 'duration_days' ? (
                            <input
                              type="number"
                              min="1"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onBlur={handleSaveEdit}
                              onKeyDown={handleKeyDown}
                              className="w-16 bg-fv-gray-800 border border-fv-blue rounded px-2 py-1 text-white focus:outline-none"
                              autoFocus
                            />
                          ) : (
                            <button
                              onClick={() => handleStartEdit(task.id, 'duration_days', task.duration_days)}
                              className="text-fv-gray-300 hover:text-fv-blue"
                            >
                              {task.duration_days}d
                            </button>
                          )}
                        </td>

                        {/* Start date */}
                        <td className="px-4 py-3 text-fv-gray-300 text-xs">
                          {formatScheduleDate(task.start_date)}
                        </td>

                        {/* End date */}
                        <td className="px-4 py-3 text-fv-gray-300 text-xs">
                          {formatScheduleDate(task.end_date)}
                        </td>

                        {/* Dependencies */}
                        <td className="px-4 py-3">
                          <DependencySelect
                            task={task}
                            allTasks={allTasks}
                            currentIndex={index}
                            onChange={handleDependencyChange}
                            disabled={disabled}
                          />
                        </td>
                      </tr>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </tbody>
            )}
          </Droppable>
        </DragDropContext>
      </table>
      </div>
    </div>
  );
}

// Dependency selector component
function DependencySelect({
  task,
  allTasks,
  currentIndex,
  onChange,
  disabled,
}: {
  task: Task;
  allTasks: Task[];
  currentIndex: number;
  onChange: (taskId: string, depId: string, add: boolean) => void;
  disabled?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);

  // Only show tasks that come before this one
  const availableDeps = allTasks.filter((t, i) => i < currentIndex);

  const selectedDeps = task.depends_on
    .map((depId) => allTasks.find((t) => t.id === depId))
    .filter(Boolean);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled || availableDeps.length === 0}
        className="text-xs text-fv-gray-400 hover:text-fv-blue disabled:opacity-50"
      >
        {selectedDeps.length > 0 ? (
          <span className="text-fv-gray-300">
            {selectedDeps.map((d, i) => (
              <span key={d!.id}>
                {allTasks.findIndex((t) => t.id === d!.id) + 1}
                {i < selectedDeps.length - 1 ? ', ' : ''}
              </span>
            ))}
          </span>
        ) : (
          '—'
        )}
      </button>

      {isOpen && availableDeps.length > 0 && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-full mt-1 w-48 bg-fv-gray-800 border border-fv-gray-700 rounded-lg shadow-lg z-30 py-1 max-h-48 overflow-y-auto">
            {availableDeps.map((dep, i) => {
              const isSelected = task.depends_on.includes(dep.id);
              return (
                <button
                  key={dep.id}
                  onClick={() => {
                    onChange(task.id, dep.id, !isSelected);
                  }}
                  className={`
                    w-full px-3 py-2 text-left text-xs flex items-center gap-2
                    ${isSelected ? 'bg-fv-blue/20 text-fv-blue' : 'text-fv-gray-300 hover:bg-fv-gray-700'}
                  `}
                >
                  <span className="w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-fv-blue border-fv-blue' : 'border-fv-gray-600'}">
                    {isSelected && (
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </span>
                  <span className="truncate">
                    {i + 1}. {dep.name}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
