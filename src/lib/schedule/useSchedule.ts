'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Project, LineItem, Task, ScheduleState } from '@/lib/supabase/types';

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
    throw new Error(error.error || 'Request failed');
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

  // Parse PDF
  const parsePDF = useCallback(async (file: File, text: string) => {
    if (!state.project) return;

    setState((s) => ({ ...s, status: 'loading', error: null }));

    try {
      const formData = new FormData();
      formData.append('pdf', file);
      formData.append('text', text);

      const anonymousId = getAnonymousId();
      const headers: HeadersInit = {};
      if (anonymousId) {
        headers['x-anonymous-id'] = anonymousId;
      }

      const response = await fetch(`/api/schedule/${state.project.id}/parse`, {
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
    } catch (err) {
      setState((s) => ({
        ...s,
        status: 'error',
        error: (err as Error).message,
      }));
    }
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

  // Generate schedule
  const generateSchedule = useCallback(async (startDate?: string, workDays?: 'mon-fri' | 'mon-sat') => {
    if (!state.project) return;

    setState((s) => ({ ...s, status: 'loading', error: null }));

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
    } catch (err) {
      setState((s) => ({
        ...s,
        status: 'error',
        error: (err as Error).message,
      }));
    }
  }, [state.project]);

  // Update tasks (with autosave)
  const updateTasks = useCallback((tasks: Task[], immediate = false) => {
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

  // Ask the Field
  const askTheField = useCallback(async (question: string): Promise<string> => {
    if (!state.project) return 'No project loaded.';

    const data = await apiFetch(`/api/schedule/${state.project.id}/ask`, {
      method: 'POST',
      body: JSON.stringify({ question }),
    });

    return data.answer;
  }, [state.project]);

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
    askTheField,
  };
}
