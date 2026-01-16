'use client';

import { useState } from 'react';

export default function SchedulePage() {
  const [projectName, setProjectName] = useState('Untitled Project');
  const [status, setStatus] = useState<'draft' | 'saved'>('draft');

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
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="bg-transparent border-b border-transparent hover:border-fv-gray-600 focus:border-fv-blue focus:outline-none px-1 py-0.5 text-white font-medium"
            />
            <span className={`text-xs px-2 py-0.5 rounded ${
              status === 'saved' ? 'bg-green-900/50 text-green-400' : 'bg-fv-gray-800 text-fv-gray-400'
            }`}>
              {status === 'saved' ? 'Saved' : 'Draft'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Undo/Redo */}
          <button className="p-2 text-fv-gray-400 hover:text-white disabled:opacity-30" disabled>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
          </button>
          <button className="p-2 text-fv-gray-400 hover:text-white disabled:opacity-30" disabled>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
            </svg>
          </button>

          {/* Export CSV */}
          <button
            className="px-4 py-1.5 bg-fv-blue hover:bg-fv-blue-light text-white text-sm font-medium rounded disabled:opacity-30 disabled:cursor-not-allowed"
            disabled
          >
            Export CSV
          </button>
        </div>
      </header>

      {/* Main Content - 2 Pane Layout */}
      <div className="flex-1 flex">
        {/* Left Pane - Inputs */}
        <div className="w-[400px] border-r border-fv-gray-800 p-6 overflow-y-auto">
          {/* Card 1: PDF Upload */}
          <div className="bg-fv-gray-900 rounded-lg p-4 mb-4">
            <h3 className="text-sm font-semibold text-fv-gray-300 mb-3">1. Upload Contract PDF</h3>
            <div className="border-2 border-dashed border-fv-gray-700 rounded-lg p-8 text-center hover:border-fv-blue transition-colors cursor-pointer">
              <svg className="w-10 h-10 mx-auto text-fv-gray-500 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="text-sm text-fv-gray-400">Drop PDF here or click to browse</p>
              <p className="text-xs text-fv-gray-600 mt-1">Contract, scope, or bid document</p>
            </div>
          </div>

          {/* Card 2: Line Items (placeholder) */}
          <div className="bg-fv-gray-900 rounded-lg p-4 mb-4">
            <h3 className="text-sm font-semibold text-fv-gray-300 mb-3">2. Review Extracted Items</h3>
            <div className="text-center py-8 text-fv-gray-500 text-sm">
              Upload a PDF to extract line items
            </div>
          </div>

          {/* Card 3: Settings */}
          <div className="bg-fv-gray-900 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-fv-gray-300 mb-3">3. Schedule Settings</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-fv-gray-400 mb-1">Start Date</label>
                <input
                  type="date"
                  className="w-full bg-fv-gray-800 border border-fv-gray-700 rounded px-3 py-2 text-sm text-white focus:border-fv-blue focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs text-fv-gray-400 mb-1">Work Week</label>
                <select className="w-full bg-fv-gray-800 border border-fv-gray-700 rounded px-3 py-2 text-sm text-white focus:border-fv-blue focus:outline-none">
                  <option value="mon-fri">Mon - Fri (5 days)</option>
                  <option value="mon-sat">Mon - Sat (6 days)</option>
                </select>
              </div>

              <button
                className="w-full py-2.5 bg-fv-blue hover:bg-fv-blue-light text-white font-medium rounded disabled:opacity-30 disabled:cursor-not-allowed"
                disabled
              >
                Generate Schedule
              </button>
            </div>
          </div>
        </div>

        {/* Right Pane - Schedule Editor */}
        <div className="flex-1 flex flex-col">
          {/* Schedule Table Area */}
          <div className="flex-1 p-6 overflow-auto">
            <div className="bg-fv-gray-900 rounded-lg h-full flex items-center justify-center">
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
          </div>

          {/* Gantt Preview Area */}
          <div className="h-48 border-t border-fv-gray-800 p-4">
            <div className="bg-fv-gray-900 rounded-lg h-full flex items-center justify-center">
              <p className="text-sm text-fv-gray-500">Gantt chart will appear here</p>
            </div>
          </div>

          {/* Ask the Field Sidebar Toggle */}
          <div className="absolute right-0 top-1/2 -translate-y-1/2">
            <button className="bg-fv-gray-800 hover:bg-fv-gray-700 text-fv-gray-400 hover:text-white px-2 py-4 rounded-l-lg text-xs font-medium writing-mode-vertical">
              Ask the Field
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
