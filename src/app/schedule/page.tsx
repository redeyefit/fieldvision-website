'use client';

import { useState, useCallback, useEffect, Suspense, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useSchedule } from '@/lib/schedule/useSchedule';
import { PDFUploader } from '@/components/schedule/PDFUploader';
import { LineItemsTable } from '@/components/schedule/LineItemsTable';
import { ScheduleTable } from '@/components/schedule/ScheduleTable';
import { GanttBars } from '@/components/schedule/GanttBars';
import { AskTheField } from '@/components/schedule/AskTheField';

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
    reorderTasks,
    updateTasks,
    exportCSV,
    askTheField,
    askGeneralConstruction,
  } = useSchedule(projectIdFromUrl || undefined);

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

  // Local state for project name to prevent glitchy typing
  const [localName, setLocalName] = useState<string | null>(null);

  // Only initialize localName once when project first loads
  // After that, user has full control
  useEffect(() => {
    if (project?.name && localName === null) {
      setLocalName(project.name);
    }
  }, [project?.name, localName]);

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

  const handleAskProject = useCallback(async (question: string): Promise<string> => {
    return askTheField(question);
  }, [askTheField]);

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

  const steps = [
    { num: 1, label: 'Upload', done: lineItems.length > 0 || !!project?.pdf_url },
    { num: 2, label: 'Review', done: confirmedCount > 0 },
    { num: 3, label: 'Generate', done: tasks.length > 0 },
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
          {/* Logo */}
          <a href="/" className="flex items-center gap-2">
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
              <GanttBars tasks={tasks} />
            </div>
          </div>
        </div>

        {/* Ask the Field Sidebar - positioned outside grid */}
        <AskTheField
          isOpen={askFieldOpen}
          onToggle={() => setAskFieldOpen(!askFieldOpen)}
          onAskProject={handleAskProject}
          onAskGeneral={handleAskGeneral}
          disabled={isLoading}
        />
      </div>
    </div>
  );
}
