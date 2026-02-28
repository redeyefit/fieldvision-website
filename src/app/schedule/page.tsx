'use client';

import { useState, useCallback, useEffect, Suspense, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useSchedule } from '@/lib/schedule/useSchedule';
import { PDFUploader } from '@/components/schedule/PDFUploader';
import { LineItemsTable } from '@/components/schedule/LineItemsTable';
import { ScheduleTable } from '@/components/schedule/ScheduleTable';
import { GanttBars } from '@/components/schedule/GanttBars';
import { AskTheField } from '@/components/schedule/AskTheField';
import { Task, AskResponse, ValidatedOperation, Project } from '@/lib/supabase/types';
import { createAuthClient } from '@/lib/supabase/client';

// Wrapper to handle Suspense for useSearchParams
export default function SchedulePage() {
  return (
    <Suspense fallback={<ScheduleLoadingFallback />}>
      <SchedulePageContent />
    </Suspense>
  );
}

function ScheduleLoadingFallback() {
  return (
    <div className="min-h-screen bg-fv-black text-white flex items-center justify-center">
      <div className="flex items-center gap-3">
        <svg className="animate-spin w-6 h-6 text-fv-blue" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        <span>Loading Schedule Maker...</span>
      </div>
    </div>
  );
}

function SchedulePageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const projectIdFromUrl = searchParams.get('id');
  const [routeDecision, setRouteDecision] = useState<'loading' | 'editor' | 'dashboard'>('loading');

  useEffect(() => {
    // If there's a project ID, always show editor — no check needed
    if (projectIdFromUrl) {
      setRouteDecision('editor');
      return;
    }

    // No ?id — figure out where to send the user
    const decide = async () => {
      // 1. Check if logged in → dashboard
      try {
        const supabase = createAuthClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setRouteDecision('dashboard');
          return;
        }
      } catch {
        // Not authenticated, continue
      }

      // 2. Check if anonymous user has existing projects → auto-redirect to most recent
      const anonymousId = typeof window !== 'undefined'
        ? localStorage.getItem(ANONYMOUS_ID_KEY)
        : null;

      if (anonymousId) {
        try {
          const res = await fetch('/api/schedule', {
            headers: { 'x-anonymous-id': anonymousId },
          });
          if (res.ok) {
            const data = await res.json();
            if (data.projects?.length > 0) {
              // Redirect to most recent project (already sorted by updated_at desc)
              router.replace(`/schedule?id=${data.projects[0].id}`);
              return;
            }
          }
        } catch {
          // API error, fall through to editor
        }
      }

      // 3. Brand new user — show editor directly
      setRouteDecision('editor');
    };

    decide();
  }, [projectIdFromUrl, router]);

  if (routeDecision === 'loading') {
    return <ScheduleLoadingFallback />;
  }

  if (routeDecision === 'dashboard') {
    return <ScheduleDashboard />;
  }

  return <ScheduleEditor projectIdFromUrl={projectIdFromUrl || undefined} />;
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

const ANONYMOUS_ID_KEY = 'fieldvision_anonymous_id';

interface DashboardProject extends Project {
  task_count?: number;
}

function ScheduleDashboard() {
  const router = useRouter();
  const [projects, setProjects] = useState<DashboardProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Check auth state
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const supabase = createAuthClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.email) {
          setUserEmail(user.email);
        }
      } catch {
        // Not authenticated, that's fine
      }
    };
    checkAuth();
  }, []);

  // Fetch projects
  useEffect(() => {
    const fetchProjects = async () => {
      setLoading(true);
      setError(null);
      try {
        const anonymousId = typeof window !== 'undefined'
          ? localStorage.getItem(ANONYMOUS_ID_KEY)
          : null;

        const headers: HeadersInit = { 'Content-Type': 'application/json' };
        if (anonymousId) {
          (headers as Record<string, string>)['x-anonymous-id'] = anonymousId;
        }

        const res = await fetch('/api/schedule', { headers });

        if (res.status === 401) {
          // No anonymous ID and not authenticated — show empty state
          setProjects([]);
          setLoading(false);
          return;
        }

        if (!res.ok) {
          throw new Error('Failed to load projects');
        }

        const data = await res.json();
        setProjects(data.projects || []);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };
    fetchProjects();
  }, []);

  // Create new project
  const handleCreate = async () => {
    setCreating(true);
    try {
      const anonymousId = typeof window !== 'undefined'
        ? localStorage.getItem(ANONYMOUS_ID_KEY)
        : null;

      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (anonymousId) {
        (headers as Record<string, string>)['x-anonymous-id'] = anonymousId;
      }

      const res = await fetch('/api/schedule', {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: 'Untitled Project' }),
      });

      if (!res.ok) throw new Error('Failed to create project');

      const data = await res.json();

      // Store anonymous ID if returned
      if (data.anonymous_id && typeof window !== 'undefined') {
        localStorage.setItem(ANONYMOUS_ID_KEY, data.anonymous_id);
      }

      router.push(`/schedule?id=${data.project.id}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCreating(false);
    }
  };

  // Delete project
  const handleDelete = async (projectId: string) => {
    if (!confirm('Delete this schedule? This cannot be undone.')) return;

    setDeletingId(projectId);
    try {
      const anonymousId = typeof window !== 'undefined'
        ? localStorage.getItem(ANONYMOUS_ID_KEY)
        : null;

      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (anonymousId) {
        (headers as Record<string, string>)['x-anonymous-id'] = anonymousId;
      }

      const res = await fetch(`/api/schedule/${projectId}`, {
        method: 'DELETE',
        headers,
      });

      if (!res.ok) throw new Error('Failed to delete project');

      setProjects((prev) => prev.filter((p) => p.id !== projectId));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDeletingId(null);
    }
  };

  // Sign out
  const handleSignOut = async () => {
    try {
      const supabase = createAuthClient();
      await supabase.auth.signOut();
      setUserEmail(null);
      // Refresh project list (will now use anonymous ID only)
      window.location.reload();
    } catch {
      // ignore
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="min-h-screen bg-fv-black text-white">
      {/* Header */}
      <header className="h-14 border-b border-white/10 px-6 flex items-center justify-between bg-fv-gray-900/50 backdrop-blur-sm">
        <a href="/" className="flex items-center gap-2">
          <img src="/logo_backup.png" alt="FieldVision" className="h-8 w-8" />
          <span className="font-display font-semibold text-lg">Schedule Maker</span>
        </a>

        <div className="flex items-center gap-3">
          {userEmail ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-white/60">{userEmail}</span>
              <button
                onClick={handleSignOut}
                className="text-sm text-white/40 hover:text-white/70 transition-colors"
              >
                Sign out
              </button>
            </div>
          ) : (
            <a
              href="/auth"
              className="text-sm text-fv-blue hover:text-fv-blue/80 transition-colors"
            >
              Sign in to sync across devices
            </a>
          )}
        </div>
      </header>

      {/* Main */}
      <main className="max-w-4xl mx-auto px-6 py-12">
        {/* Title + Create */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-semibold">My Schedules</h1>
          <button
            onClick={handleCreate}
            disabled={creating}
            className="px-4 py-2 bg-fv-blue hover:bg-fv-blue/90 text-white font-medium rounded-lg disabled:opacity-60 flex items-center gap-2 transition-colors"
          >
            {creating ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Creating...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New Schedule
              </>
            )}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 px-4 py-3 rounded-lg bg-red-900/20 border border-red-500/20 text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="flex items-center gap-3 text-white/60">
              <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>Loading schedules...</span>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && projects.length === 0 && (
          <div className="text-center py-20">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/5 mb-6">
              <svg className="w-8 h-8 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h2 className="text-lg font-medium text-white/80 mb-2">No schedules yet</h2>
            <p className="text-sm text-white/40 mb-6 max-w-sm mx-auto">
              Upload a contract PDF and we&apos;ll extract line items, generate a construction schedule, and export it as CSV, Excel, or PDF.
            </p>
            <button
              onClick={handleCreate}
              disabled={creating}
              className="px-5 py-2.5 bg-fv-blue hover:bg-fv-blue/90 text-white font-medium rounded-lg disabled:opacity-60 transition-colors"
            >
              Create your first schedule
            </button>
          </div>
        )}

        {/* Project Grid */}
        {!loading && projects.length > 0 && (
          <div className="grid gap-3">
            {projects.map((project) => (
              <div
                key={project.id}
                className="group rounded-xl border border-white/10 bg-white/5 hover:bg-white/[0.08] transition-colors p-4 flex items-center justify-between"
              >
                <div
                  className="flex-1 min-w-0 cursor-pointer"
                  onClick={() => router.push(`/schedule?id=${project.id}`)}
                >
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="font-medium text-white truncate">{project.name}</h3>
                    {project.pdf_url && (
                      <span className="flex-shrink-0 text-[10px] uppercase tracking-wider text-fv-blue bg-fv-blue/10 px-1.5 py-0.5 rounded">
                        PDF
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-white/40">
                    <span>Updated {formatDate(project.updated_at)}</span>
                    {project.start_date && (
                      <span>Starts {project.start_date}</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => router.push(`/schedule?id=${project.id}`)}
                    className="px-3 py-1.5 text-sm text-white/70 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
                  >
                    Open
                  </button>
                  <button
                    onClick={() => handleDelete(project.id)}
                    disabled={deletingId === project.id}
                    className="px-3 py-1.5 text-sm text-red-400/70 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-40"
                  >
                    {deletingId === project.id ? (
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    ) : (
                      'Delete'
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

// ─── Editor (existing, unchanged) ────────────────────────────────────────────

function ScheduleEditor({ projectIdFromUrl }: { projectIdFromUrl?: string }) {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);

  // Check auth state for header display
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const supabase = createAuthClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.email) setUserEmail(user.email);
      } catch {
        // Not authenticated
      }
    };
    checkAuth();
  }, []);

  const {
    project,
    lineItems,
    tasks,
    status,
    error,
    createProject,
    updateProject,
    parsePDF,
    updateLineItems,
    confirmAllLineItems,
    generateSchedule,
    importSchedule,
    reorderTasks,
    updateTasks,
    exportCSV,
    askTheField,
    askGeneralConstruction,
    applyAIModification,
  } = useSchedule(projectIdFromUrl);

  // Update URL when project is created/loaded
  useEffect(() => {
    if (project?.id && project.id !== projectIdFromUrl) {
      router.replace(`/schedule?id=${project.id}`, { scroll: false });
    }
  }, [project?.id, projectIdFromUrl, router]);

  const isLoading = status === 'loading' || status === 'saving';

  const [askFieldOpen, setAskFieldOpen] = useState(false);
  const [startDate, setStartDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [workDays, setWorkDays] = useState<'mon-fri' | 'mon-sat'>('mon-fri');

  // Separate state for schedule generation to avoid showing "Generating..." during line item saves
  const [isGenerating, setIsGenerating] = useState(false);

  // Import mode state
  const [scheduleMode, setScheduleMode] = useState<'generate' | 'import'>('generate');
  const [isImporting, setIsImporting] = useState(false);
  const [inferDeps, setInferDeps] = useState(true);
  const [csvText, setCsvText] = useState('');
  const [parsedImportTasks, setParsedImportTasks] = useState<Array<{
    name: string;
    trade: string;
    duration_days: number;
    start_date: string;
    end_date: string;
  }>>([]);
  const [importParseError, setImportParseError] = useState<string | null>(null);
  const [isParsingPDF, setIsParsingPDF] = useState(false);

  // Local state for project name to prevent glitchy typing
  const [localName, setLocalName] = useState<string | null>(null);

  // Only initialize localName once when project first loads
  // After that, user has full control
  useEffect(() => {
    if (project?.name && localName === null) {
      setLocalName(project.name);
    }
  }, [project?.name, localName]);

  // Selected task (shared between table and Gantt)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // ESC to clear selection
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedTaskId(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Resizable split between schedule and Gantt (0 = all schedule, 1 = all Gantt)
  const [splitRatio, setSplitRatio] = useState(0.5); // Default 50/50
  const isDraggingRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isDraggingRef.current = true;
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current || !containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const dividerHeight = 12; // h-3 = 12px
      const availableHeight = containerRect.height - dividerHeight;

      // Calculate where the mouse is relative to the container
      const mouseY = e.clientY - containerRect.top;
      const scheduleHeight = mouseY;

      // Calculate ratio (how much of the space goes to Gantt)
      const newRatio = 1 - (scheduleHeight / availableHeight);

      // Clamp between 0.1 (10% Gantt) and 0.9 (90% Gantt)
      setSplitRatio(Math.max(0.1, Math.min(0.9, newRatio)));
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const handlePDFUpload = useCallback(async (file: File, text: string) => {
    // Create project first if one doesn't exist
    let projectId = project?.id;
    if (!projectId) {
      projectId = await createProject('Untitled Project');
      if (!projectId) {
        console.error('Failed to create project');
        return;
      }
    }
    await parsePDF(file, text, projectId);
  }, [project, createProject, parsePDF]);

  const handleGenerateSchedule = useCallback(async () => {
    const confirmedItems = lineItems.filter((item) => item.confirmed);
    if (confirmedItems.length === 0) {
      alert('Please confirm at least one line item before generating a schedule.');
      return;
    }
    setIsGenerating(true);
    try {
      await generateSchedule(startDate, workDays);
    } finally {
      setIsGenerating(false);
    }
  }, [lineItems, startDate, workDays, generateSchedule]);

  const handleExport = useCallback(async () => {
    try {
      await exportCSV();
    } catch (err) {
      console.error('Export failed:', err);
    }
  }, [exportCSV]);

  const handleAskProject = useCallback(async (question: string): Promise<AskResponse> => {
    return askTheField(question);
  }, [askTheField]);

  const handleApplyModification = useCallback(async (operations: ValidatedOperation[]) => {
    await applyAIModification(operations);
  }, [applyAIModification]);

  const handleAskGeneral = useCallback(async (question: string): Promise<string> => {
    return askGeneralConstruction(question);
  }, [askGeneralConstruction]);

  const handleNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalName(e.target.value);
  }, []);

  const handleNameBlur = useCallback(() => {
    const currentName = localName ?? '';
    const nameToSave = currentName.trim() || 'Untitled Project';
    if (nameToSave !== project?.name) {
      updateProject({ name: nameToSave });
    }
    // If user left it empty, show the default in the input
    if (!currentName.trim()) {
      setLocalName('Untitled Project');
    }
  }, [localName, project?.name, updateProject]);

  // Wrapper to update a single task
  const handleUpdateTask = useCallback((taskId: string, updates: Partial<typeof tasks[0]>) => {
    const updatedTasks = tasks.map((task) =>
      task.id === taskId ? { ...task, ...updates } : task
    );
    updateTasks(updatedTasks);
  }, [tasks, updateTasks]);

  // Add a new blank task (afterIndex = insert after that index, undefined = append at end)
  const handleAddTask = useCallback((afterIndex?: number) => {
    const insertAt = afterIndex !== undefined ? afterIndex + 1 : tasks.length;
    const prevTask = afterIndex !== undefined ? tasks[afterIndex] : tasks[tasks.length - 1];
    const today = new Date().toISOString().split('T')[0];
    const startDate = prevTask?.end_date || today;

    const newTask: Task = {
      id: crypto.randomUUID(),
      project_id: project?.id || '',
      name: 'New Task',
      trade: null,
      duration_days: 1,
      start_date: startDate,
      end_date: startDate,
      depends_on: prevTask ? [prevTask.id] : [],
      sequence_index: insertAt,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const updatedTasks = [...tasks];
    updatedTasks.splice(insertAt, 0, newTask);
    // Re-index all sequence indices
    const reindexed = updatedTasks.map((t, i) => ({ ...t, sequence_index: i }));

    updateTasks(reindexed, true);
    setSelectedTaskId(newTask.id);
  }, [tasks, project, updateTasks]);

  // Delete a task
  const handleDeleteTask = useCallback((taskId: string) => {
    // Remove the task and clean up any references to it in other tasks' depends_on
    const updatedTasks = tasks
      .filter((t) => t.id !== taskId)
      .map((t, index) => ({
        ...t,
        depends_on: t.depends_on.filter((depId) => depId !== taskId),
        sequence_index: index,
      }));

    if (selectedTaskId === taskId) setSelectedTaskId(null);
    updateTasks(updatedTasks, true);
  }, [tasks, selectedTaskId, updateTasks]);

  // Split a CSV line respecting quoted fields
  const splitCSVLine = useCallback((line: string, delimiter: string): string[] => {
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') {
          current += '"';
          i++; // skip escaped quote
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          current += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === delimiter) {
          fields.push(current.trim());
          current = '';
        } else {
          current += ch;
        }
      }
    }
    fields.push(current.trim());
    return fields;
  }, []);

  // Parse CSV text into import tasks
  const parseCSV = useCallback((text: string) => {
    setCsvText(text);
    setImportParseError(null);

    if (!text.trim()) {
      setParsedImportTasks([]);
      return;
    }

    try {
      const lines = text.trim().split('\n').map((line) => line.trim()).filter(Boolean);
      if (lines.length < 2) {
        setImportParseError('Need at least a header row and one data row');
        setParsedImportTasks([]);
        return;
      }

      // Parse header - support common delimiters
      const delimiter = lines[0].includes('\t') ? '\t' : ',';
      const headers = splitCSVLine(lines[0], delimiter).map((h) => h.toLowerCase().replace(/['"]/g, ''));

      // Find column indices - flexible matching
      const nameIdx = headers.findIndex((h) => ['task', 'name', 'activity', 'description', 'task name', 'activity name'].includes(h));
      const tradeIdx = headers.findIndex((h) => ['trade', 'category', 'trade category', 'csi', 'division'].includes(h));
      const durationIdx = headers.findIndex((h) => ['duration', 'days', 'duration (days)', 'duration_days', 'dur'].includes(h));
      const startIdx = headers.findIndex((h) => ['start', 'start date', 'start_date', 'begin', 'begin date'].includes(h));
      const endIdx = headers.findIndex((h) => ['end', 'end date', 'end_date', 'finish', 'finish date'].includes(h));

      if (nameIdx === -1) {
        setImportParseError('Missing required column: Task/Name/Activity');
        setParsedImportTasks([]);
        return;
      }

      if (startIdx === -1 && endIdx === -1) {
        setImportParseError('Need at least a Start Date or End Date column');
        setParsedImportTasks([]);
        return;
      }

      const tasks: typeof parsedImportTasks = [];

      for (let i = 1; i < lines.length; i++) {
        const cols = splitCSVLine(lines[i], delimiter);
        const name = cols[nameIdx]?.trim();
        if (!name) continue;

        const trade = tradeIdx >= 0 ? (cols[tradeIdx]?.trim() || 'General Conditions') : 'General Conditions';
        const startRaw = startIdx >= 0 ? cols[startIdx]?.trim() : '';
        const endRaw = endIdx >= 0 ? cols[endIdx]?.trim() : '';
        const durationRaw = durationIdx >= 0 ? cols[durationIdx]?.trim() : '';

        // Parse dates - support MM/DD/YYYY, YYYY-MM-DD, MM-DD-YYYY
        const parseDate = (d: string): string => {
          if (!d) return '';
          // Already ISO format
          if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
          // MM/DD/YYYY or MM-DD-YYYY
          const match = d.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
          if (match) {
            const [, m, day, y] = match;
            return `${y}-${m.padStart(2, '0')}-${day.padStart(2, '0')}`;
          }
          // Try native parse
          const parsed = new Date(d);
          if (!isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];
          return '';
        };

        let startDate = parseDate(startRaw);
        let endDate = parseDate(endRaw);
        let duration = parseInt(durationRaw) || 0;

        // Calculate missing fields
        if (startDate && endDate && !duration) {
          const s = new Date(startDate);
          const e = new Date(endDate);
          duration = Math.max(1, Math.round((e.getTime() - s.getTime()) / 86400000));
        } else if (startDate && duration && !endDate) {
          const s = new Date(startDate);
          s.setDate(s.getDate() + duration);
          endDate = s.toISOString().split('T')[0];
        } else if (endDate && duration && !startDate) {
          const e = new Date(endDate);
          e.setDate(e.getDate() - duration);
          startDate = e.toISOString().split('T')[0];
        }

        if (!startDate || !endDate) {
          setImportParseError(`Row ${i}: Could not determine dates for "${name}"`);
          setParsedImportTasks([]);
          return;
        }

        tasks.push({
          name,
          trade,
          duration_days: duration || 1,
          start_date: startDate,
          end_date: endDate,
        });
      }

      if (tasks.length === 0) {
        setImportParseError('No valid tasks found in CSV');
        setParsedImportTasks([]);
        return;
      }

      setParsedImportTasks(tasks);
    } catch {
      setImportParseError('Failed to parse CSV. Check the format and try again.');
      setParsedImportTasks([]);
    }
  }, [splitCSVLine]);

  // Handle file upload (CSV, Excel, or PDF)
  const handleScheduleFile = useCallback(async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();

    if (ext === 'pdf') {
      // Parse PDF schedule — try client-side regex first, fall back to server API
      setIsParsingPDF(true);
      setImportParseError(null);
      setParsedImportTasks([]);
      setCsvText('');
      try {
        // Step 1: Extract text client-side
        let clientText = '';
        try {
          const pdfjsLib = await import('pdfjs-dist');
          const { setupPdfWorker } = await import('@/lib/pdf/worker-setup');
          const { extractTextFromPdfDocument } = await import('@/lib/pdf/extract-text');
          setupPdfWorker(pdfjsLib);
          const arrayBuffer = await file.arrayBuffer();
          const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
          clientText = await extractTextFromPdfDocument(pdf, 100_000);
          console.log(`[PDF Import] Client extracted ${clientText.length} chars`);
        } catch (pdfErr) {
          console.warn('[PDF Import] Client-side PDF extraction failed:', pdfErr);
        }

        // Step 2: Try regex client-side — if it works, skip the API call entirely
        // This avoids body size limits, timeouts, and server extraction issues
        if (clientText.length >= 50) {
          try {
            const { tryRegexExtract } = await import('@/lib/pdf/regex-parser');
            const regexTasks = tryRegexExtract(clientText);
            if (regexTasks && regexTasks.length > 0) {
              console.log(`[PDF Import] Client regex extracted ${regexTasks.length} tasks — skipping server`);
              setParsedImportTasks(regexTasks);
              return;
            }
            console.log('[PDF Import] Client regex found no tasks, falling back to server');
            console.log('[PDF Import] First 500 chars of client text:', clientText.slice(0, 500));
            console.log('[PDF Import] First 10 lines:', clientText.split('\n').slice(0, 10));
          } catch (regexErr) {
            console.warn('[PDF Import] Client regex failed:', regexErr);
          }
        }

        // Step 3: Fall back to server API (Gemini AI parsing)
        // Auto-create project if needed (server API requires a project ID)
        let projectId = project?.id;
        if (!projectId) {
          projectId = await createProject('Untitled Project');
          if (!projectId) {
            setImportParseError('Failed to create project. Please try again.');
            return;
          }
        }

        const formData = new FormData();
        // Skip sending PDF binary if client text is good enough (avoids body size limits)
        // Server can parse with just text via regex or Gemini
        if (clientText.length >= 200) {
          formData.append('text', clientText);
          // Only send PDF if it's under 4MB (Vercel body limit is ~4.5MB)
          if (file.size < 4 * 1024 * 1024) {
            formData.append('pdf', file);
          } else {
            console.log(`[PDF Import] Skipping PDF binary (${(file.size / 1024 / 1024).toFixed(1)}MB) — sending text only`);
          }
        } else {
          formData.append('pdf', file);
          if (clientText.length >= 50) {
            formData.append('text', clientText);
          }
        }

        const headers: Record<string, string> = {};
        const anonymousId = typeof window !== 'undefined'
          ? localStorage.getItem(ANONYMOUS_ID_KEY) : null;
        if (anonymousId) {
          headers['x-anonymous-id'] = anonymousId;
        }

        const response = await fetch(`/api/schedule/${projectId}/parse-import`, {
          method: 'POST',
          headers,
          body: formData,
        });

        // Safely parse response — may not be JSON if server errors (502/504/413)
        let data: { error?: string; tasks?: Array<{ name: string; trade: string; duration_days: number; start_date: string; end_date: string }>; debug?: Record<string, unknown> };
        const raw = await response.text();
        try {
          data = JSON.parse(raw);
        } catch {
          console.error(`[PDF Import] Non-JSON response (${response.status}):`, raw.slice(0, 300));
          setImportParseError(`Server error (${response.status}). The PDF may be too large or processing timed out. Try a smaller file or CSV export.`);
          return;
        }

        // Always log diagnostics so we can see what happened
        if (data.debug) {
          console.log('[PDF Import] Server diagnostics:', JSON.stringify(data.debug, null, 2));
        }

        if (!response.ok) {
          const debugHint = data.debug
            ? ` [step: ${data.debug.step}, server: ${data.debug.serverTextLen} chars, client: ${data.debug.clientTextLen} chars, regex-s: ${data.debug.regexServerTasks}, regex-c: ${data.debug.regexClientTasks}${data.debug.textPreview ? `, preview: "${String(data.debug.textPreview).slice(0, 120)}..."` : ''}]`
            : '';
          setImportParseError((data.error || 'Failed to parse PDF schedule') + debugHint);
          return;
        }

        if (data.tasks && data.tasks.length > 0) {
          setParsedImportTasks(data.tasks);
        } else {
          setImportParseError('No schedule tasks found in PDF.');
        }
      } catch (err) {
        console.error('[PDF Import] Unexpected error:', err);
        setImportParseError('Failed to parse PDF. Please try again.');
      } finally {
        setIsParsingPDF(false);
      }
    } else if (ext === 'xlsx' || ext === 'xls') {
      // Parse Excel file
      try {
        const XLSX = await import('xlsx');
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const csvText = XLSX.utils.sheet_to_csv(sheet);
        parseCSV(csvText);
      } catch {
        setImportParseError('Failed to parse Excel file. Try exporting as CSV.');
      }
    } else {
      // Read as text (CSV, TSV, TXT)
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        parseCSV(text);
      };
      reader.readAsText(file);
    }
  }, [parseCSV, project?.id, createProject]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    handleScheduleFile(file);
  }, [handleScheduleFile]);

  // Drag-and-drop state
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleScheduleFile(file);
  }, [handleScheduleFile]);

  // Handle import
  const handleImportSchedule = useCallback(async () => {
    if (parsedImportTasks.length === 0) return;

    // Create project first if one doesn't exist
    let pid = project?.id;
    if (!pid) {
      pid = await createProject('Untitled Project');
      if (!pid) return;
    }

    setIsImporting(true);
    try {
      await importSchedule(parsedImportTasks, inferDeps);
      // Clear import state on success
      setCsvText('');
      setParsedImportTasks([]);
      setImportParseError(null);
    } finally {
      setIsImporting(false);
    }
  }, [parsedImportTasks, project, createProject, importSchedule, inferDeps]);

  const confirmedCount = lineItems.filter((i) => i.confirmed).length;
  const canGenerate = confirmedCount > 0 && startDate && !isGenerating;
  const canExport = tasks.length > 0 && !isLoading;

  // Calculate current step
  const getCurrentStep = () => {
    if (tasks.length > 0) return 4; // Schedule generated - ready to export
    if (confirmedCount > 0) return 3; // Items confirmed - ready to generate
    if (lineItems.length > 0) return 2; // Items extracted - need confirmation
    if (project?.pdf_url || lineItems.length > 0) return 1; // PDF uploaded
    return 0; // Start
  };
  const currentStep = getCurrentStep();

  const steps = scheduleMode === 'generate'
    ? [
        { num: 1, label: 'Upload', done: lineItems.length > 0 || !!project?.pdf_url },
        { num: 2, label: 'Review', done: confirmedCount > 0 },
        { num: 3, label: 'Generate', done: tasks.length > 0 },
        { num: 4, label: 'Export', done: false },
      ]
    : [
        { num: 1, label: 'Import', done: parsedImportTasks.length > 0 },
        { num: 2, label: 'Review', done: parsedImportTasks.length > 0 },
        { num: 3, label: 'Link', done: tasks.length > 0 },
        { num: 4, label: 'Export', done: false },
      ];

  // Export dropdown state
  const [exportOpen, setExportOpen] = useState(false);

  const handleExportExcel = useCallback(async () => {
    if (tasks.length === 0) return;
    const XLSX = await import('xlsx');
    const data = tasks.map((task, i) => ({
      'ID': i + 1,
      'Task': task.name,
      'Trade': task.trade || 'General',
      'Duration (Days)': task.duration_days,
      'Start': task.start_date,
      'End': task.end_date,
      'Depends On': task.depends_on?.map(id => {
        const idx = tasks.findIndex(t => t.id === id);
        return idx >= 0 ? idx + 1 : '';
      }).filter(Boolean).join(', ') || '',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Schedule');
    XLSX.writeFile(wb, `${project?.name || 'schedule'}.xlsx`);
    setExportOpen(false);
  }, [tasks, project?.name]);

  const handleExportPDF = useCallback(async () => {
    if (tasks.length === 0) return;
    const { jsPDF } = await import('jspdf');
    const autoTable = (await import('jspdf-autotable')).default;

    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text(project?.name || 'Construction Schedule', 14, 22);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 30);

    autoTable(doc, {
      startY: 38,
      head: [['#', 'Task', 'Trade', 'Days', 'Start', 'End']],
      body: tasks.map((task, i) => [
        i + 1,
        task.name,
        task.trade || 'General',
        task.duration_days,
        task.start_date,
        task.end_date,
      ]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [59, 155, 217] },
    });

    doc.save(`${project?.name || 'schedule'}.pdf`);
    setExportOpen(false);
  }, [tasks, project?.name]);

  const handleExportCSV = useCallback(async () => {
    await exportCSV();
    setExportOpen(false);
  }, [exportCSV]);

  return (
    <div className="h-screen bg-fv-black text-white flex flex-col overflow-hidden">
      {/* Header */}
      <header className="h-14 border-b border-fv-gray-800 px-6 flex items-center justify-between bg-fv-gray-900/50 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          {/* Logo + Back to dashboard */}
          <a href="/schedule" className="flex items-center gap-2">
            <img src="/logo_backup.png" alt="FieldVision" className="h-8 w-8" />
            <span className="font-display font-semibold text-lg">Schedule Maker</span>
          </a>

          {/* Project Name */}
          <div className="flex items-center gap-2 ml-6">
            <input
              type="text"
              value={localName ?? ''}
              onChange={handleNameChange}
              onBlur={handleNameBlur}
              placeholder="Untitled Project"
              className="bg-transparent border-b border-transparent hover:border-fv-gray-600 focus:border-fv-blue focus:outline-none px-1 py-0.5 text-white font-medium placeholder:text-fv-gray-500"
            />
            {isLoading && (
              <div className="flex items-center gap-1.5 text-xs text-fv-blue">
                <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>{status === 'loading' ? 'Loading...' : 'Saving...'}</span>
              </div>
            )}
          </div>

          {/* Step Progress */}
          <div className="flex items-center gap-1 ml-6">
            {steps.map((step, i) => (
              <div key={step.num} className="flex items-center">
                <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                  step.done
                    ? 'bg-green-900/50 text-green-400'
                    : currentStep === step.num
                      ? 'bg-fv-blue/20 text-fv-blue'
                      : 'bg-fv-gray-800 text-fv-gray-500'
                }`}>
                  {step.done ? (
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <span className="w-3 text-center">{step.num}</span>
                  )}
                  <span>{step.label}</span>
                </div>
                {i < steps.length - 1 && (
                  <div className={`w-4 h-px mx-1 ${step.done ? 'bg-green-400' : 'bg-fv-gray-700'}`} />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Auth status */}
          {userEmail ? (
            <a href="/schedule" className="text-xs text-white/50 hover:text-white/70 transition-colors">
              {userEmail}
            </a>
          ) : (
            <a
              href="/auth"
              className="text-xs text-fv-blue hover:text-fv-blue/80 transition-colors"
            >
              Sign in to sync across devices
            </a>
          )}

          {/* Error display */}
          {error && (
            <span className="text-xs text-red-400 bg-red-900/20 px-2 py-1 rounded">
              {error}
            </span>
          )}

          {/* Export Dropdown */}
          <div className="relative">
            <button
              onClick={() => setExportOpen(!exportOpen)}
              className="px-4 py-1.5 bg-fv-blue hover:bg-fv-blue-light text-white text-sm font-medium rounded disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2"
              disabled={!canExport}
            >
              Export
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {exportOpen && canExport && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setExportOpen(false)} />
                <div className="absolute right-0 top-full mt-1 w-40 bg-fv-gray-800 border border-fv-gray-700 rounded-lg shadow-lg z-30 py-1">
                  <button
                    onClick={handleExportCSV}
                    className="w-full px-3 py-2 text-left text-sm text-white hover:bg-fv-gray-700 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    CSV (Universal)
                  </button>
                  <button
                    onClick={handleExportExcel}
                    className="w-full px-3 py-2 text-left text-sm text-white hover:bg-fv-gray-700 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M14.5 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V7.5L14.5 2zM14 3.5L18.5 8H14V3.5zM8 17l2-4-2-4h1.5l1.25 2.5L12 9h1.5l-2 4 2 4H12l-1.25-2.5L9.5 17H8z"/>
                    </svg>
                    Excel (.xlsx)
                  </button>
                  <button
                    onClick={handleExportPDF}
                    className="w-full px-3 py-2 text-left text-sm text-white hover:bg-fv-gray-700 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4 text-red-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M14.5 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V7.5L14.5 2zM14 3.5L18.5 8H14V3.5zM10.5 11c.83 0 1.5.67 1.5 1.5v1c0 .83-.67 1.5-1.5 1.5H9v2H7.5v-6h3zm4.5 0c.83 0 1.5.67 1.5 1.5v3c0 .83-.67 1.5-1.5 1.5h-2.5v-6H15zm-6 1.5v1.5h1c.28 0 .5-.22.5-.5v-.5c0-.28-.22-.5-.5-.5H9zm4.5 0v3h1c.28 0 .5-.22.5-.5v-2c0-.28-.22-.5-.5-.5h-1z"/>
                    </svg>
                    PDF
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Content - 2 Pane Layout */}
      <div className="flex-1 flex relative overflow-hidden">
        {/* Left Pane - Inputs */}
        <div className="w-[400px] border-r border-fv-gray-800 p-6 overflow-y-auto flex-shrink-0">
          {/* Mode Toggle */}
          <div className="flex bg-fv-gray-900 rounded-lg p-1 mb-4">
            <button
              onClick={() => setScheduleMode('generate')}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                scheduleMode === 'generate'
                  ? 'bg-fv-blue text-white'
                  : 'text-fv-gray-400 hover:text-white'
              }`}
            >
              Generate from Contract
            </button>
            <button
              onClick={() => setScheduleMode('import')}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                scheduleMode === 'import'
                  ? 'bg-fv-blue text-white'
                  : 'text-fv-gray-400 hover:text-white'
              }`}
            >
              Import Existing
            </button>
          </div>

          {scheduleMode === 'generate' ? (
            <>
              {/* Card 1: PDF Upload */}
              <div className="bg-fv-gray-900 rounded-lg p-4 mb-4">
                <h3 className="text-sm font-semibold text-fv-gray-300 mb-3">1. Upload Contract PDF</h3>
                <PDFUploader
                  onUpload={handlePDFUpload}
                  disabled={isLoading}
                  pdfUrl={project?.pdf_url}
                />
              </div>

              {/* Card 2: Line Items */}
              <div className="bg-fv-gray-900 rounded-lg p-4 mb-4">
                <h3 className="text-sm font-semibold text-fv-gray-300 mb-3">2. Review Extracted Items</h3>
                <LineItemsTable
                  items={lineItems}
                  onUpdate={updateLineItems}
                  onConfirmAll={confirmAllLineItems}
                  disabled={isLoading}
                />
              </div>

              {/* Card 3: Settings */}
              <div className="bg-fv-gray-900 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-fv-gray-300 mb-3">3. Schedule Settings</h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs text-fv-gray-400 mb-1">Start Date</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full bg-fv-gray-800 border border-fv-gray-700 rounded px-3 py-2 text-sm text-white focus:border-fv-blue focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-fv-gray-400 mb-1">Work Week</label>
                    <select
                      value={workDays}
                      onChange={(e) => setWorkDays(e.target.value as 'mon-fri' | 'mon-sat')}
                      className="w-full bg-fv-gray-800 border border-fv-gray-700 rounded px-3 py-2 text-sm text-white focus:border-fv-blue focus:outline-none"
                    >
                      <option value="mon-fri">Mon - Fri (5 days)</option>
                      <option value="mon-sat">Mon - Sat (6 days)</option>
                    </select>
                  </div>

                  <button
                    onClick={handleGenerateSchedule}
                    className="w-full py-2.5 bg-fv-blue hover:bg-fv-blue-light text-white font-medium rounded disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    disabled={!canGenerate}
                  >
                    {isGenerating ? (
                      <>
                        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Generating...
                      </>
                    ) : (
                      'Generate Schedule'
                    )}
                  </button>

                  {confirmedCount === 0 && lineItems.length > 0 && (
                    <p className="text-xs text-fv-gray-500 text-center">
                      Confirm at least one line item to generate
                    </p>
                  )}
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Import Card 1: Paste or Upload CSV/Excel */}
              <div
                className={`bg-fv-gray-900 rounded-lg p-4 mb-4 transition-colors ${
                  isDragOver ? 'ring-2 ring-fv-blue bg-fv-blue/5' : ''
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <h3 className="text-sm font-semibold text-fv-gray-300 mb-3">1. Paste or Upload Schedule</h3>
                <p className="text-xs text-fv-gray-500 mb-3">
                  Paste from Excel/Google Sheets, upload a CSV/Excel/PDF file, or drag and drop. Columns: Task, Trade, Start Date, End Date, Duration.
                </p>

                {isDragOver ? (
                  <div className="w-full h-32 bg-fv-blue/10 border-2 border-dashed border-fv-blue rounded flex items-center justify-center">
                    <p className="text-sm text-fv-blue font-medium">Drop file here</p>
                  </div>
                ) : (
                  <textarea
                    value={csvText}
                    onChange={(e) => parseCSV(e.target.value)}
                    placeholder={`Task,Trade,Start Date,End Date\nDemo Kitchen,Demolition,03/01/2026,03/05/2026\nFraming,Wood & Plastics,03/06/2026,03/20/2026\nPlumbing Rough,Plumbing,03/21/2026,03/28/2026`}
                    className="w-full h-32 bg-fv-gray-800 border border-fv-gray-700 rounded px-3 py-2 text-sm text-white font-mono placeholder:text-fv-gray-600 focus:border-fv-blue focus:outline-none resize-none"
                  />
                )}

                <div className="mt-2 flex items-center gap-2">
                  <label className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-fv-gray-800 border border-fv-gray-700 rounded text-sm text-fv-gray-400 hover:text-white hover:border-fv-gray-600 cursor-pointer transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    Upload CSV / Excel / PDF
                    <input
                      type="file"
                      accept=".csv,.tsv,.txt,.xlsx,.xls,.pdf"
                      onChange={handleFileInput}
                      className="hidden"
                    />
                  </label>
                </div>

                {isParsingPDF && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-fv-blue">
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Extracting schedule from PDF...
                  </div>
                )}

                {importParseError && (
                  <p className="mt-2 text-xs text-red-400">{importParseError}</p>
                )}
              </div>

              {/* Import Card 2: Preview */}
              <div className="bg-fv-gray-900 rounded-lg p-4 mb-4">
                <h3 className="text-sm font-semibold text-fv-gray-300 mb-3">
                  2. Review ({parsedImportTasks.length} tasks)
                </h3>

                {parsedImportTasks.length === 0 ? (
                  <p className="text-xs text-fv-gray-500">Paste or upload a schedule to preview tasks</p>
                ) : (
                  <div className="max-h-60 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-fv-gray-500 border-b border-fv-gray-700">
                          <th className="text-left py-1.5 pr-2">#</th>
                          <th className="text-left py-1.5 pr-2">Task</th>
                          <th className="text-left py-1.5 pr-2">Start</th>
                          <th className="text-left py-1.5">Days</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsedImportTasks.map((task, i) => (
                          <tr key={i} className="border-b border-fv-gray-800 text-fv-gray-300">
                            <td className="py-1.5 pr-2 text-fv-gray-500">{i + 1}</td>
                            <td className="py-1.5 pr-2 truncate max-w-[160px]" title={task.name}>{task.name}</td>
                            <td className="py-1.5 pr-2 text-fv-gray-400">{task.start_date}</td>
                            <td className="py-1.5 text-fv-gray-400">{task.duration_days}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Import Card 3: Settings + Import Button */}
              <div className="bg-fv-gray-900 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-fv-gray-300 mb-3">3. Import Settings</h3>

                <div className="space-y-4">
                  {/* Infer Dependencies Toggle */}
                  <label className="flex items-center justify-between cursor-pointer group">
                    <div>
                      <span className="text-sm text-white">AI Dependency Inference</span>
                      <p className="text-xs text-fv-gray-500 mt-0.5">
                        Claude analyzes trade sequencing to link tasks
                      </p>
                    </div>
                    <div
                      className={`relative w-10 h-5 rounded-full transition-colors ${
                        inferDeps ? 'bg-fv-blue' : 'bg-fv-gray-700'
                      }`}
                      onClick={() => setInferDeps(!inferDeps)}
                    >
                      <div
                        className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                          inferDeps ? 'translate-x-5' : 'translate-x-0.5'
                        }`}
                      />
                    </div>
                  </label>

                  <button
                    onClick={handleImportSchedule}
                    className="w-full py-2.5 bg-fv-blue hover:bg-fv-blue-light text-white font-medium rounded disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    disabled={parsedImportTasks.length === 0 || isImporting}
                  >
                    {isImporting ? (
                      <>
                        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        {inferDeps ? 'Importing & Linking...' : 'Importing...'}
                      </>
                    ) : (
                      <>
                        Import Schedule
                        {inferDeps && (
                          <span className="text-xs opacity-70">+ AI Dependencies</span>
                        )}
                      </>
                    )}
                  </button>

                  {parsedImportTasks.length === 0 && csvText && !importParseError && (
                    <p className="text-xs text-fv-gray-500 text-center">
                      No tasks parsed yet
                    </p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Right Pane - Schedule Editor - Using CSS Grid with fr units */}
        <div
          ref={containerRef}
          className="flex-1 min-w-0 overflow-hidden"
          style={{
            display: 'grid',
            gridTemplateRows: `${(1 - splitRatio)}fr 12px ${splitRatio}fr`,
          }}
        >
          {/* Schedule Table Area */}
          <div className="px-6 pt-6 pb-0 overflow-hidden min-h-0">
            <div className="bg-fv-gray-900 rounded-lg h-full overflow-hidden flex flex-col min-h-0">
              <ScheduleTable
                tasks={tasks}
                allTasks={tasks}
                onReorder={reorderTasks}
                onUpdateTask={handleUpdateTask}
                onAddTask={handleAddTask}
                onDeleteTask={handleDeleteTask}
                selectedTaskId={selectedTaskId}
                onSelectTask={setSelectedTaskId}
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Resizable Divider */}
          <div
            onMouseDownCapture={handleDividerMouseDown}
            className="bg-fv-gray-800 hover:bg-fv-blue cursor-ns-resize flex items-center justify-center group transition-colors relative z-20"
          >
            <div className="w-12 h-1 bg-fv-gray-600 group-hover:bg-white rounded-full transition-colors" />
          </div>

          {/* Gantt Preview Area */}
          <div className="px-4 pb-4 pt-0 overflow-hidden min-h-0">
            <div className="bg-fv-gray-900 rounded-lg h-full overflow-auto">
              <GanttBars
                tasks={tasks}
                selectedTaskId={selectedTaskId}
                onSelectTask={setSelectedTaskId}
                disabled={isLoading}
              />
            </div>
          </div>
        </div>

        {/* Ask the Field Sidebar - positioned outside grid */}
        <AskTheField
          isOpen={askFieldOpen}
          onToggle={() => setAskFieldOpen(!askFieldOpen)}
          onAskProject={handleAskProject}
          onAskGeneral={handleAskGeneral}
          onApplyModification={handleApplyModification}
          disabled={isLoading}
        />
      </div>
    </div>
  );
}
// PDF import redeploy trigger
