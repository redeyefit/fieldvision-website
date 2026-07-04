'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import type { Project } from '@/lib/supabase/types';

interface Org {
  orgId: string;
  orgName: string;
  role: 'owner' | 'admin' | 'member';
  plan: string;
  status: string;
}

function ProjectsInner() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const [projRes, orgRes] = await Promise.all([
        fetch('/api/schedule'),
        fetch('/api/orgs'),
      ]);
      if (!projRes.ok) throw new Error('projects');
      const projData = await projRes.json();
      const orgData = orgRes.ok ? await orgRes.json() : { orgs: [] };
      setProjects(projData.projects ?? []);
      setOrgs(orgData.orgs ?? []);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // The first org where the user is owner/admin — the target for new projects.
  const adminOrg = orgs.find((o) => o.role === 'owner' || o.role === 'admin');
  const orgNameById = new Map(orgs.map((o) => [o.orgId, o.orgName]));

  const createProject = useCallback(async () => {
    if (!adminOrg) return;
    const name = window.prompt('New project name?')?.trim();
    if (!name) return;
    setCreating(true);
    try {
      const res = await fetch('/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, org_id: adminOrg.orgId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        window.alert(err.message || err.error || 'Failed to create project');
        return;
      }
      const data = await res.json();
      if (data.project?.id) {
        router.push(`/projects/${data.project.id}`);
      } else {
        load();
      }
    } finally {
      setCreating(false);
    }
  }, [adminOrg, router, load]);

  return (
    <div className="min-h-screen bg-fv-black text-fv-gray-100">
      <header className="border-b border-fv-gray-800 bg-fv-black/80">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <h1 className="text-lg font-semibold">Projects</h1>
          {adminOrg && (
            <button
              onClick={createProject}
              disabled={creating}
              className="rounded-md bg-fv-blue px-3 py-2 text-sm font-medium text-white hover:bg-fv-blue-light disabled:opacity-50"
            >
              {creating ? 'Creating…' : '+ New Project'}
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        {status === 'loading' && <p className="text-fv-gray-500">Loading projects…</p>}
        {status === 'error' && (
          <p className="text-red-400">Couldn’t load projects. <button onClick={load} className="underline">Retry</button></p>
        )}
        {status === 'ready' && projects.length === 0 && (
          <div className="rounded-lg border border-dashed border-fv-gray-800 p-8 text-center">
            <p className="text-fv-gray-400">No projects yet.</p>
            {adminOrg && <p className="mt-1 text-sm text-fv-gray-500">Create your first team project above.</p>}
          </div>
        )}
        {status === 'ready' && projects.length > 0 && (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/projects/${p.id}`}
                  className="block rounded-lg border border-fv-gray-800 bg-fv-gray-900/40 p-4 transition-colors hover:border-fv-blue/50 hover:bg-fv-gray-900"
                >
                  <p className="truncate font-medium">{p.name || 'Untitled Project'}</p>
                  <p className="mt-1 text-xs text-fv-gray-500">
                    {p.org_id ? (orgNameById.get(p.org_id) ?? 'Team') : 'Personal'}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

export default function ProjectsPage() {
  return (
    <ProtectedRoute>
      <ProjectsInner />
    </ProtectedRoute>
  );
}
