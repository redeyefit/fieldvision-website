'use client';

import Link from 'next/link';

// Mirrors the iOS project screen's information architecture. Each module either
// links to a working page or is shown muted with a "Soon" badge (we don't clutter
// the shell with dead tabs — only Schedule + Reports are wired in v1).
type ModuleKey =
  | 'overview' | 'contract' | 'schedule' | 'schedule-health' | 'progress'
  | 'blueprints' | 'room-scans' | 'zones'
  | 'photos' | 'todo' | 'notes' | 'reports';

interface NavItem {
  key: ModuleKey;
  label: string;
  href?: string;          // present = wired; absent = "Soon"
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

function buildNav(projectId: string): NavGroup[] {
  return [
    {
      title: 'Project Management',
      items: [
        { key: 'contract', label: 'Contract & Scope' },
        { key: 'schedule', label: 'Schedule', href: `/schedule?id=${projectId}` },
        { key: 'schedule-health', label: 'Schedule Health' },
        { key: 'progress', label: 'Progress Dashboard' },
      ],
    },
    {
      title: 'Blueprint Analysis',
      items: [
        { key: 'blueprints', label: 'Blueprints' },
        { key: 'room-scans', label: 'Room Scans' },
        { key: 'zones', label: 'Manage Zones' },
      ],
    },
    {
      title: 'Results & Reports',
      items: [
        { key: 'photos', label: 'Photo Gallery' },
        { key: 'todo', label: 'To-Do List' },
        { key: 'notes', label: 'Recent Notes' },
        { key: 'reports', label: 'View Reports', href: `/reports?project_id=${projectId}` },
      ],
    },
  ];
}

export function ProjectLayout({
  projectId,
  projectName,
  active = 'overview',
  children,
}: {
  projectId: string;
  projectName: string;
  active?: ModuleKey;
  children: React.ReactNode;
}) {
  const nav = buildNav(projectId);

  return (
    <div className="min-h-screen bg-fv-black text-fv-gray-100">
      {/* Top bar */}
      <header className="sticky top-0 z-10 border-b border-fv-gray-800 bg-fv-black/80 backdrop-blur">
        <div className="flex items-center gap-3 px-4 py-3">
          <Link href="/projects" className="text-sm text-fv-blue hover:text-fv-blue-light">
            ← Projects
          </Link>
          <span className="text-fv-gray-600">/</span>
          <h1 className="truncate text-base font-semibold">{projectName || 'Project'}</h1>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl gap-6 px-4 py-6">
        {/* Left nav — mirrors the iOS module groups */}
        <nav className="hidden w-56 shrink-0 md:block">
          {nav.map((group) => (
            <div key={group.title} className="mb-6">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-fv-gray-500">
                {group.title}
              </p>
              <ul className="space-y-1">
                {group.items.map((item) => {
                  const isActive = item.key === active;
                  if (item.href) {
                    return (
                      <li key={item.key}>
                        <Link
                          href={item.href}
                          className={`block rounded-md px-3 py-2 text-sm transition-colors ${
                            isActive
                              ? 'bg-fv-blue/15 text-fv-blue'
                              : 'text-fv-gray-300 hover:bg-fv-gray-900 hover:text-fv-gray-100'
                          }`}
                        >
                          {item.label}
                        </Link>
                      </li>
                    );
                  }
                  return (
                    <li key={item.key}>
                      <span className="flex items-center justify-between rounded-md px-3 py-2 text-sm text-fv-gray-600">
                        {item.label}
                        <span className="rounded bg-fv-gray-800 px-1.5 py-0.5 text-[10px] uppercase text-fv-gray-500">
                          Soon
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Content */}
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
