'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { ProjectLayout } from '@/components/layout/ProjectLayout';
import type { Project } from '@/lib/supabase/types';

function ProjectOverviewInner({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<Project | null>(null);
  const [taskCount, setTaskCount] = useState(0);
  const [status, setStatus] = useState<'loading' | 'ready' | 'notfound' | 'error'>('loading');

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const res = await fetch(`/api/schedule/${projectId}`);
      if (res.status === 404 || res.status === 403) {
        setStatus('notfound');
        return;
      }
      if (!res.ok) throw new Error('load');
      const data = await res.json();
      setProject(data.project ?? null);
      setTaskCount(Array.isArray(data.tasks) ? data.tasks.length : 0);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  if (status === 'notfound') {
    return (
      <div className="min-h-screen bg-fv-black p-8 text-fv-gray-100">
        <p className="text-fv-gray-400">This project doesn’t exist or you don’t have access.</p>
        <Link href="/projects" className="mt-2 inline-block text-fv-blue hover:underline">← Back to projects</Link>
      </div>
    );
  }

  const name = project?.name || 'Project';

  return (
    <ProjectLayout projectId={projectId} projectName={name} active="overview">
      {status === 'loading' && <p className="text-fv-gray-500">Loading…</p>}
      {status === 'error' && (
        <p className="text-red-400">Couldn’t load this project. <button onClick={load} className="underline">Retry</button></p>
      )}
      {status === 'ready' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold">{name}</h2>
            <p className="mt-1 text-sm text-fv-gray-500">
              {project?.org_id ? 'Team project' : 'Personal project'}
              {project?.start_date ? ` · starts ${project.start_date}` : ''}
            </p>
          </div>

          {/* Wired modules — the rest live in the left nav as "Soon" */}
          <div className="grid gap-3 sm:grid-cols-2">
            <Link
              href={`/schedule?id=${projectId}`}
              className="rounded-lg border border-fv-gray-800 bg-fv-gray-900/40 p-4 transition-colors hover:border-fv-blue/50 hover:bg-fv-gray-900"
            >
              <p className="font-medium">Schedule</p>
              <p className="mt-1 text-sm text-fv-gray-500">
                {taskCount > 0 ? `${taskCount} task${taskCount === 1 ? '' : 's'}` : 'Build the project schedule'}
              </p>
            </Link>
            <Link
              href={`/reports?project_id=${projectId}`}
              className="rounded-lg border border-fv-gray-800 bg-fv-gray-900/40 p-4 transition-colors hover:border-fv-blue/50 hover:bg-fv-gray-900"
            >
              <p className="font-medium">Daily Reports</p>
              <p className="mt-1 text-sm text-fv-gray-500">View the project’s field reports</p>
            </Link>
          </div>
        </div>
      )}
    </ProjectLayout>
  );
}

export default function ProjectOverviewPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  return (
    <ProtectedRoute>
      <ProjectOverviewInner projectId={projectId} />
    </ProtectedRoute>
  );
}
