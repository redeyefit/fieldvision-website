'use client';

import { useState, useCallback } from 'react';
import { useSchedule } from '@/lib/schedule/useSchedule';
import { PDFUploader } from '@/components/schedule/PDFUploader';
import { LineItemsTable } from '@/components/schedule/LineItemsTable';
import { ScheduleTable } from '@/components/schedule/ScheduleTable';
import { GanttBars } from '@/components/schedule/GanttBars';
import { AskTheField } from '@/components/schedule/AskTheField';

export default function SchedulePage() {
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
  } = useSchedule();

  const isLoading = status === 'loading' || status === 'saving';

  const [askFieldOpen, setAskFieldOpen] = useState(false);
  const [startDate, setStartDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [workDays, setWorkDays] = useState<'mon-fri' | 'mon-sat'>('mon-fri');

  const handlePDFUpload = useCallback(async (file: File, text: string) => {
    // Create project first if one doesn't exist
    if (!project) {
      await createProject('Untitled Project');
    }
    await parsePDF(file, text);
  }, [project, createProject, parsePDF]);

  const handleGenerateSchedule = useCallback(async () => {
    const confirmedItems = lineItems.filter((item) => item.confirmed);
    if (confirmedItems.length === 0) {
      alert('Please confirm at least one line item before generating a schedule.');
      return;
    }
    await generateSchedule(startDate, workDays);
  }, [lineItems, startDate, workDays, generateSchedule]);

  const handleExport = useCallback(async () => {
    try {
      await exportCSV();
    } catch (err) {
      console.error('Export failed:', err);
    }
  }, [exportCSV]);

  const handleAskQuestion = useCallback(async (question: string): Promise<string> => {
    return askTheField(question);
  }, [askTheField]);

  const handleNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    updateProject({ name: e.target.value });
  }, [updateProject]);

  // Wrapper to update a single task
  const handleUpdateTask = useCallback((taskId: string, updates: Partial<typeof tasks[0]>) => {
    const updatedTasks = tasks.map((task) =>
      task.id === taskId ? { ...task, ...updates } : task
    );
    updateTasks(updatedTasks);
  }, [tasks, updateTasks]);

  const confirmedCount = lineItems.filter((i) => i.confirmed).length;
  const canGenerate = confirmedCount > 0 && startDate && !isLoading;
  const canExport = tasks.length > 0 && !isLoading;

  return (
    <div className="min-h-screen bg-fv-black text-white flex flex-col">
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
              value={project?.name || 'Untitled Project'}
              onChange={handleNameChange}
              className="bg-transparent border-b border-transparent hover:border-fv-gray-600 focus:border-fv-blue focus:outline-none px-1 py-0.5 text-white font-medium"
            />
            <span className={`text-xs px-2 py-0.5 rounded ${
              project?.id ? 'bg-green-900/50 text-green-400' : 'bg-fv-gray-800 text-fv-gray-400'
            }`}>
              {project?.id ? 'Saved' : 'Draft'}
            </span>
            {isLoading && (
              <svg className="animate-spin w-4 h-4 text-fv-blue" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Error display */}
          {error && (
            <span className="text-xs text-red-400 bg-red-900/20 px-2 py-1 rounded">
              {error}
            </span>
          )}

          {/* Export CSV */}
          <button
            onClick={handleExport}
            className="px-4 py-1.5 bg-fv-blue hover:bg-fv-blue-light text-white text-sm font-medium rounded disabled:opacity-30 disabled:cursor-not-allowed"
            disabled={!canExport}
          >
            Export CSV
          </button>
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
                {isLoading ? (
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

        {/* Right Pane - Schedule Editor */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Schedule Table Area */}
          <div className="flex-1 p-6 overflow-hidden">
            <div className="bg-fv-gray-900 rounded-lg h-full flex flex-col overflow-hidden">
              <ScheduleTable
                tasks={tasks}
                allTasks={tasks}
                onReorder={reorderTasks}
                onUpdateTask={handleUpdateTask}
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Gantt Preview Area */}
          <div className="h-56 border-t border-fv-gray-800 p-4">
            <div className="bg-fv-gray-900 rounded-lg h-full overflow-hidden">
              <GanttBars tasks={tasks} />
            </div>
          </div>

          {/* Ask the Field Sidebar */}
          <AskTheField
            isOpen={askFieldOpen}
            onToggle={() => setAskFieldOpen(!askFieldOpen)}
            onAsk={handleAskQuestion}
            disabled={isLoading || tasks.length === 0}
          />
        </div>
      </div>
    </div>
  );
}
