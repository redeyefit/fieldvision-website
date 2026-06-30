'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { DailyReport } from '@/lib/supabase/types';

export default function ReportsPage() {
  return (
    <ProtectedRoute>
      <Suspense fallback={<ReportsLoadingFallback />}>
        <ReportsPageContent />
      </Suspense>
    </ProtectedRoute>
  );
}

function ReportsLoadingFallback() {
  return (
    <div className="min-h-screen bg-fv-black text-white flex items-center justify-center">
      <div className="flex items-center gap-3">
        <svg className="animate-spin w-6 h-6 text-fv-blue" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        <span>Loading Reports...</span>
      </div>
    </div>
  );
}

interface ProjectOption {
  id: string;
  name: string;
}

function ReportsPageContent() {
  const { supabase } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get('project_id');

  const [reports, setReports] = useState<DailyReport[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>(projectId || '');
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('loading');
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // Fetch user's projects
  useEffect(() => {
    async function fetchProjects() {
      try {
        const res = await fetch('/api/schedule');
        if (!res.ok) return;
        const data = await res.json();
        setProjects(data.projects || []);
        // Auto-select first project if none selected
        if (!selectedProject && data.projects?.length > 0) {
          setSelectedProject(data.projects[0].id);
        }
      } catch {
        // Projects fetch failed — non-critical
      }
    }
    fetchProjects();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch reports when project changes
  const fetchReports = useCallback(async () => {
    if (!selectedProject) {
      setReports([]);
      setStatus('idle');
      return;
    }
    setStatus('loading');
    try {
      const url = `/api/reports?project_id=${selectedProject}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch reports');
      const data = await res.json();
      setReports(data.reports || []);
      setStatus('idle');
    } catch {
      setStatus('error');
    }
  }, [selectedProject]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // Generate new report
  const handleGenerate = async () => {
    if (!selectedProject) return;
    setGenerating(true);
    setGenerateError(null);
    try {
      const res = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: selectedProject,
          date: new Date().toISOString(),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Generation failed');
      }
      const data = await res.json();
      // Navigate to the new report
      router.push(`/reports/${data.report.id}`);
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getPreview = (text: string | null) => {
    if (!text) return 'No content';
    // Strip markdown headers and get first ~150 chars
    const clean = text.replace(/#{1,3}\s*/g, '').replace(/\*{1,2}/g, '');
    return clean.length > 150 ? clean.slice(0, 150) + '...' : clean;
  };

  return (
    <div className="min-h-screen bg-fv-black text-white">
      {/* Header */}
      <header className="border-b border-fv-gray-800 bg-fv-black/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/')}
              className="text-fv-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-xl font-semibold">Daily Reports</h1>
          </div>
          <button
            onClick={handleGenerate}
            disabled={generating || !selectedProject}
            className="bg-fv-blue hover:bg-fv-blue-light disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            {generating ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Generating...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Generate Report
              </>
            )}
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Project selector */}
        {projects.length > 0 && (
          <div className="mb-6">
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="bg-fv-gray-800 border border-fv-gray-700 text-white rounded-lg px-4 py-2.5 w-full max-w-xs focus:outline-none focus:ring-2 focus:ring-fv-blue"
            >
              <option value="">Select a project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Generate error */}
        {generateError && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
            {generateError}
          </div>
        )}

        {/* Reports list */}
        {status === 'loading' ? (
          <div className="flex justify-center py-12">
            <svg className="animate-spin w-8 h-8 text-fv-blue" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
        ) : status === 'error' ? (
          <div className="text-center py-12">
            <p className="text-red-400 mb-3">Failed to load reports</p>
            <button
              onClick={fetchReports}
              className="text-fv-blue hover:text-fv-blue-light text-sm"
            >
              Try again
            </button>
          </div>
        ) : reports.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-fv-gray-800 flex items-center justify-center">
              <svg className="w-8 h-8 text-fv-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-fv-gray-300 mb-1">No reports yet</h3>
            <p className="text-fv-gray-500 text-sm mb-6">
              {selectedProject
                ? 'Generate your first AI daily report from captured field data.'
                : 'Select a project to view or generate reports.'}
            </p>
            {selectedProject && (
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="bg-fv-blue hover:bg-fv-blue-light text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors"
              >
                Generate First Report
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {reports.map((report) => (
              <button
                key={report.id}
                onClick={() => router.push(`/reports/${report.id}`)}
                className="w-full text-left bg-fv-gray-800/50 hover:bg-fv-gray-800 border border-fv-gray-700/50 hover:border-fv-gray-600 rounded-xl p-4 transition-all group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-white">
                        {formatDate(report.date)}
                      </span>
                      {report.project_name && (
                        <span className="text-xs text-fv-gray-500 truncate">
                          {report.project_name}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-fv-gray-400 line-clamp-2">
                      {getPreview(report.work_status)}
                    </p>
                    {report.ai_context && (
                      <div className="flex items-center gap-3 mt-2 text-xs text-fv-gray-500">
                        {(() => {
                          try {
                            const ctx = JSON.parse(report.ai_context);
                            return (
                              <>
                                {ctx.photo_count > 0 && (
                                  <span>{ctx.photo_count} photos</span>
                                )}
                                {ctx.voice_note_count > 0 && (
                                  <span>{ctx.voice_note_count} voice notes</span>
                                )}
                                {ctx.log_entry_count > 0 && (
                                  <span>{ctx.log_entry_count} log entries</span>
                                )}
                              </>
                            );
                          } catch {
                            return null;
                          }
                        })()}
                      </div>
                    )}
                  </div>
                  <svg
                    className="w-5 h-5 text-fv-gray-600 group-hover:text-fv-gray-400 transition-colors flex-shrink-0 mt-0.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
