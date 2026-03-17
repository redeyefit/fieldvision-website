'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Project, LineItem, Task, ScheduleState, ValidatedOperation, AskResponse } from '@/lib/supabase/types';

const AUTOSAVE_DELAY = 2000; // 2 seconds
const ANONYMOUS_ID_KEY = 'fieldvision_anonymous_id';

// Get or create anonymous ID
function getAnonymousId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ANONYMOUS_ID_KEY);
}

function setAnonymousId(id: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ANONYMOUS_ID_KEY, id);
}

// API helper with anonymous ID header
async function apiFetch(url: string, options: RequestInit = {}) {
  const anonymousId = getAnonymousId();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (anonymousId) {
    (headers as Record<string, string>)['x-anonymous-id'] = anonymousId;
  }

  const response = await fetch(url, { ...options, headers });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.message || error.error || 'Request failed');
  }

  return response.json();
}

export function useSchedule(projectId?: string) {
  const [state, setState] = useState<ScheduleState>({
    project: null,
    lineItems: [],
    tasks: [],
    status: 'idle',
    lastSaved: null,
    error: null,
  });

  const autosaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingTasksRef = useRef<Task[] | null>(null);
  const isApplyingAIRef = useRef(false);

  // Load project data
  const loadProject = useCallback(async (id: string) => {
    setState((s) => ({ ...s, status: 'loading', error: null }));

    try {
      const data = await apiFetch(`/api/schedule/${id}`);
      setState({
        project: data.project,
        lineItems: data.line_items,
        tasks: data.tasks,
        status: 'idle',
        lastSaved: new Date(),
        error: null,
      });
    } catch (err) {
      setState((s) => ({
        ...s,
        status: 'error',
        error: (err as Error).message,
      }));
    }
  }, []);

  // Create new project
  const createProject = useCallback(async (name: string) => {
    setState((s) => ({ ...s, status: 'loading', error: null }));

    try {
      const data = await apiFetch('/api/schedule', {
        method: 'POST',
        body: JSON.stringify({ name }),
      });

      // Store anonymous ID if provided
      if (data.anonymous_id) {
        setAnonymousId(data.anonymous_id);
      }

      setState({
        project: data.project,
        lineItems: [],
        tasks: [],
        status: 'idle',
        lastSaved: new Date(),
        error: null,
      });

      return data.project.id;
    } catch (err) {
      setState((s) => ({
        ...s,
        status: 'error',
        error: (err as Error).message,
      }));
      return null;
    }
  }, []);

  // Update project
  const updateProject = useCallback(async (updates: Partial<Project>) => {
    if (!state.project) return;

    setState((s) => ({ ...s, status: 'saving' }));

    try {
      const data = await apiFetch(`/api/schedule/${state.project.id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });

      setState((s) => ({
        ...s,
        project: data.project,
        status: 'idle',
        lastSaved: new Date(),
      }));
    } catch (err) {
      setState((s) => ({
        ...s,
        status: 'error',
        error: (err as Error).message,
      }));
    }
  }, [state.project]);

  // Parse PDF with retry logic for network interruptions
  const parsePDF = useCallback(async (file: File, text: string, projectId?: string) => {
    const pid = projectId || state.project?.id;
    if (!pid) return;

    setState((s) => ({ ...s, status: 'loading', error: null }));

    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const formData = new FormData();
        formData.append('pdf', file);
        formData.append('text', text);

        const anonymousId = getAnonymousId();
        const headers: HeadersInit = {};
        if (anonymousId) {
          headers['x-anonymous-id'] = anonymousId;
        }

        const response = await fetch(`/api/schedule/${pid}/parse`, {
          method: 'POST',
          headers,
          body: formData,
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({ error: 'Parse failed' }));
          throw new Error(error.error || 'Parse failed');
        }

        const data = await response.json();

        setState((s) => ({
          ...s,
          lineItems: data.line_items,
          status: 'idle',
          lastSaved: new Date(),
        }));

        // Update project with PDF URL
        if (data.pdf_url && state.project) {
          setState((s) => ({
            ...s,
            project: s.project ? { ...s.project, pdf_url: data.pdf_url } : null,
          }));
        }

        return; // Success - exit the retry loop
      } catch (err) {
        lastError = err as Error;
        const isNetworkError = lastError.message.includes('network') ||
          lastError.message.includes('Failed to fetch') ||
          lastError.name === 'TypeError';

        if (isNetworkError && attempt < maxRetries) {
          // Wait with exponential backoff before retrying
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          console.log(`[Parse] Network error, retrying in ${delay}ms (attempt ${attempt}/${maxRetries})`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        // Non-network error or max retries reached
        break;
      }
    }

    // All retries failed
    setState((s) => ({
      ...s,
      status: 'error',
      error: lastError?.message || 'Parse failed after multiple attempts',
    }));
  }, [state.project]);

  // Update line items
  const updateLineItems = useCallback(async (items: LineItem[]) => {
    if (!state.project) return;

    setState((s) => ({ ...s, lineItems: items, status: 'saving' }));

    try {
      const data = await apiFetch(`/api/schedule/${state.project.id}/line-items`, {
        method: 'PATCH',
        body: JSON.stringify({ line_items: items }),
      });

      setState((s) => ({
        ...s,
        lineItems: data.line_items,
        status: 'idle',
        lastSaved: new Date(),
      }));
    } catch (err) {
      setState((s) => ({
        ...s,
        status: 'error',
        error: (err as Error).message,
      }));
    }
  }, [state.project]);

  // Confirm all line items
  const confirmAllLineItems = useCallback(async () => {
    const updatedItems = state.lineItems.map((item) => ({ ...item, confirmed: true }));
    await updateLineItems(updatedItems);
  }, [state.lineItems, updateLineItems]);

  // Generate schedule with retry logic for network interruptions
  const generateSchedule = useCallback(async (startDate?: string, workDays?: 'mon-fri' | 'mon-sat') => {
    if (!state.project) return;

    setState((s) => ({ ...s, status: 'loading', error: null }));

    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const data = await apiFetch(`/api/schedule/${state.project.id}/generate`, {
          method: 'POST',
          body: JSON.stringify({
            start_date: startDate,
            work_days: workDays,
          }),
        });

        setState((s) => ({
          ...s,
          tasks: data.tasks,
          status: 'idle',
          lastSaved: new Date(),
        }));

        return; // Success - exit the retry loop
      } catch (err) {
        lastError = err as Error;
        const isNetworkError = lastError.message.includes('network') ||
          lastError.message.includes('Failed to fetch') ||
          lastError.name === 'TypeError';

        if (isNetworkError && attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          console.log(`[Generate] Network error, retrying in ${delay}ms (attempt ${attempt}/${maxRetries})`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        break;
      }
    }

    // All retries failed
    setState((s) => ({
      ...s,
      status: 'error',
      error: lastError?.message || 'Schedule generation failed after multiple attempts',
    }));
  }, [state.project]);

  // Update tasks (with autosave) — skips if AI is applying modifications
  const updateTasks = useCallback((tasks: Task[], immediate = false) => {
    if (isApplyingAIRef.current) return; // Mutex: AI is applying changes

    setState((s) => ({ ...s, tasks }));
    pendingTasksRef.current = tasks;

    // Clear existing timeout
    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current);
    }

    // Schedule autosave
    const saveDelay = immediate ? 0 : AUTOSAVE_DELAY;
    autosaveTimeoutRef.current = setTimeout(async () => {
      if (!state.project || !pendingTasksRef.current) return;
      if (isApplyingAIRef.current) return; // Double-check mutex

      setState((s) => ({ ...s, status: 'saving' }));

      try {
        const data = await apiFetch(`/api/schedule/${state.project.id}/tasks`, {
          method: 'PATCH',
          body: JSON.stringify({
            tasks: pendingTasksRef.current,
            recalculate: true,
          }),
        });

        setState((s) => ({
          ...s,
          tasks: data.tasks,
          status: 'idle',
          lastSaved: new Date(),
        }));

        pendingTasksRef.current = null;
      } catch (err) {
        setState((s) => ({
          ...s,
          status: 'error',
          error: (err as Error).message,
        }));
      }
    }, saveDelay);
  }, [state.project]);

  // Reorder tasks (drag-drop)
  const reorderTasks = useCallback((sourceIndex: number, destIndex: number) => {
    const newTasks = [...state.tasks];
    const [removed] = newTasks.splice(sourceIndex, 1);
    newTasks.splice(destIndex, 0, removed);

    // Update sequence indices
    const reindexed = newTasks.map((task, index) => ({
      ...task,
      sequence_index: index,
    }));

    updateTasks(reindexed);
  }, [state.tasks, updateTasks]);

  // Export CSV
  const exportCSV = useCallback(async () => {
    if (!state.project) return;

    const anonymousId = getAnonymousId();
    const headers: HeadersInit = {};
    if (anonymousId) {
      headers['x-anonymous-id'] = anonymousId;
    }

    const response = await fetch(`/api/schedule/${state.project.id}/export`, {
      headers,
    });

    if (!response.ok) {
      throw new Error('Export failed');
    }

    // Download the file
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = response.headers.get('Content-Disposition')?.split('filename=')[1]?.replace(/"/g, '') || 'schedule.csv';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }, [state.project]);

  // Ask the Field (project-specific, uses Claude with tool use)
  const askTheField = useCallback(async (question: string): Promise<AskResponse> => {
    if (!state.project) return { type: 'text', answer: 'No project loaded.' };

    const data = await apiFetch(`/api/schedule/${state.project.id}/ask`, {
      method: 'POST',
      body: JSON.stringify({ question }),
    });

    return data as AskResponse;
  }, [state.project]);

  // Apply AI modification atomically with mutex protection
  const applyAIModification = useCallback(async (operations: ValidatedOperation[]) => {
    if (!state.project) throw new Error('No project loaded');

    // Cancel any pending autosave
    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current);
      autosaveTimeoutRef.current = null;
    }

    // Set mutex to block user edits
    isApplyingAIRef.current = true;
    const previousTasks = [...state.tasks]; // Snapshot for rollback

    try {
      setState((s) => ({ ...s, status: 'saving' }));

      // Apply operations to current tasks
      let modifiedTasks = [...state.tasks];

      for (const op of operations) {
        switch (op.action) {
          case 'update': {
            modifiedTasks = modifiedTasks.map((task) => {
              if (task.id !== op.task_id) return task;
              const updated = { ...task };
              if (op.changes.name) updated.name = op.changes.name.to as string;
              if (op.changes.trade) updated.trade = op.changes.trade.to as string;
              if (op.changes.duration_days) updated.duration_days = op.changes.duration_days.to as number;
              if (op.changes.depends_on) {
                // Resolve names back to IDs
                const depNames = op.changes.depends_on.to as string[];
                updated.depends_on = depNames
                  .map((name) => modifiedTasks.find((t) => t.name === name)?.id)
                  .filter(Boolean) as string[];
              }
              return updated;
            });
            break;
          }
          case 'add': {
            const insertAfterName = op.warnings?.find((w) => w.startsWith('Inserting after'));
            const insertAfterTask = insertAfterName
              ? modifiedTasks.find((t) => insertAfterName.includes(`"${t.name}"`))
              : null;
            const insertIdx = insertAfterTask
              ? modifiedTasks.findIndex((t) => t.id === insertAfterTask.id) + 1
              : modifiedTasks.length;

            const depNames = (op.changes.depends_on?.to as string[]) || [];
            const depIds = depNames
              .map((name) => modifiedTasks.find((t) => t.name === name)?.id)
              .filter(Boolean) as string[];

            const prevTask = insertIdx > 0 ? modifiedTasks[insertIdx - 1] : null;
            const today = new Date().toISOString().split('T')[0];

            const newTask: Task = {
              id: crypto.randomUUID(),
              project_id: state.project!.id,
              name: op.changes.name?.to as string || op.task_name,
              trade: (op.changes.trade?.to as string) || null,
              duration_days: (op.changes.duration_days?.to as number) || 1,
              start_date: prevTask?.end_date || today,
              end_date: prevTask?.end_date || today,
              depends_on: depIds.length > 0 ? depIds : (prevTask ? [prevTask.id] : []),
              sequence_index: insertIdx,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };

            modifiedTasks.splice(insertIdx, 0, newTask);
            break;
          }
          case 'delete': {
            const taskId = op.task_id!;
            modifiedTasks = modifiedTasks
              .filter((t) => t.id !== taskId)
              .map((t) => ({
                ...t,
                depends_on: t.depends_on.filter((d) => d !== taskId),
              }));
            break;
          }
        }
      }

      // Re-index sequence
      modifiedTasks = modifiedTasks.map((t, i) => ({ ...t, sequence_index: i }));

      // Optimistic update
      setState((s) => ({ ...s, tasks: modifiedTasks }));

      // Save to server with recalculate
      const data = await apiFetch(`/api/schedule/${state.project!.id}/tasks`, {
        method: 'PATCH',
        body: JSON.stringify({
          tasks: modifiedTasks,
          recalculate: true,
        }),
      });

      setState((s) => ({
        ...s,
        tasks: data.tasks,
        status: 'idle',
        lastSaved: new Date(),
      }));

      pendingTasksRef.current = null;
    } catch (err) {
      // Rollback on failure
      setState((s) => ({
        ...s,
        tasks: previousTasks,
        status: 'error',
        error: (err as Error).message,
      }));
      throw err;
    } finally {
      isApplyingAIRef.current = false;
    }
  }, [state.project, state.tasks]);

  // Import schedule from CSV/Excel (preserves user dates, optionally infers dependencies)
  const importSchedule = useCallback(async (
    tasks: Array<{
      name: string;
      trade: string;
      duration_days: number;
      start_date: string;
      end_date: string;
    }>,
    inferDependencies = true
  ) => {
    if (!state.project) return;

    setState((s) => ({ ...s, status: 'loading', error: null }));

    try {
      const data = await apiFetch(`/api/schedule/${state.project.id}/import`, {
        method: 'POST',
        body: JSON.stringify({
          tasks,
          infer_dependencies: inferDependencies,
        }),
      });

      setState((s) => ({
        ...s,
        tasks: data.tasks,
        status: 'idle',
        lastSaved: new Date(),
      }));
    } catch (err) {
      setState((s) => ({
        ...s,
        status: 'error',
        error: (err as Error).message,
      }));
    }
  }, [state.project]);

  // Ask general construction questions (stateless, uses ChatGPT)
  const askGeneralConstruction = useCallback(async (question: string): Promise<string> => {
    const data = await apiFetch('/api/schedule/ask-general', {
      method: 'POST',
      body: JSON.stringify({ question }),
    });

    return data.answer;
  }, []);

  // Load project on mount if ID provided
  useEffect(() => {
    if (projectId) {
      loadProject(projectId);
    }
  }, [projectId, loadProject]);

  // Cleanup autosave timeout on unmount
  useEffect(() => {
    return () => {
      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current);
      }
    };
  }, []);

  return {
    ...state,
    loadProject,
    createProject,
    updateProject,
    parsePDF,
    updateLineItems,
    confirmAllLineItems,
    generateSchedule,
    updateTasks,
    reorderTasks,
    exportCSV,
    importSchedule,
    askTheField,
    askGeneralConstruction,
    applyAIModification,
  };
}
