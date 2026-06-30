'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { DailyReport, Photo, VoiceNote } from '@/lib/supabase/types';

export default function ReportDetailPage() {
  return (
    <ProtectedRoute>
      <ReportDetailContent />
    </ProtectedRoute>
  );
}

interface ReportSection {
  title: string;
  content: string;
}

function parseReportSections(text: string): ReportSection[] {
  const sections: ReportSection[] = [];
  // Match patterns like "## 1. WORK STATUS", "**WORK STATUS**", "WORK STATUS:", etc.
  const sectionRegex = /(?:^|\n)(?:#{1,3}\s*)?(?:\d+\.\s*)?(?:\*{1,2})?(WORK STATUS|OBSERVATIONS|NOTABLE ITEMS|RFIs?|REQUESTS? FOR INFORMATION|COORDINATION\s*ITEMS?|INSPECTIONS?|SAFETY|WEATHER|SCHEDULE|OPEN ITEMS|COMMITMENTS)(?:\*{1,2})?[:\s—-]*\n/gi;

  const matches: { title: string; index: number }[] = [];
  let match;
  while ((match = sectionRegex.exec(text)) !== null) {
    matches.push({ title: match[1].trim(), index: match.index + match[0].length });
  }

  if (matches.length === 0) {
    // No sections found — treat entire text as work status
    return [{ title: 'WORK STATUS', content: text.trim() }];
  }

  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index - (text.slice(matches[i + 1].index - 50, matches[i + 1].index).lastIndexOf('\n') > 0 ? 50 - text.slice(matches[i + 1].index - 50, matches[i + 1].index).lastIndexOf('\n') : 0) : text.length;
    // Simpler: just grab from start to next match or end
    const nextStart = i + 1 < matches.length
      ? text.lastIndexOf('\n', matches[i + 1].index)
      : text.length;
    const content = text.slice(start, nextStart > start ? nextStart : text.length).trim();
    if (content) {
      sections.push({ title: matches[i].title, content });
    }
  }

  // Add any preamble before first section
  if (matches.length > 0 && matches[0].index > 20) {
    const preambleEnd = text.lastIndexOf('\n', matches[0].index);
    const preamble = text.slice(0, preambleEnd > 0 ? preambleEnd : matches[0].index).trim();
    if (preamble.length > 10) {
      sections.unshift({ title: 'SUMMARY', content: preamble });
    }
  }

  return sections;
}

function getSectionIcon(title: string): string {
  const t = title.toUpperCase();
  if (t.includes('WORK')) return 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4';
  if (t.includes('OBSERVATION') || t.includes('NOTABLE')) return 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z';
  if (t.includes('RFI') || t.includes('REQUEST')) return 'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z';
  if (t.includes('COORDINATION')) return 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z';
  if (t.includes('INSPECTION')) return 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z';
  if (t.includes('SAFETY')) return 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z';
  return 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z';
}

function ReportDetailContent() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [report, setReport] = useState<DailyReport | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [voiceNotes, setVoiceNotes] = useState<VoiceNote[]>([]);
  const [status, setStatus] = useState<'loading' | 'error' | 'loaded'>('loading');
  const [activeAudio, setActiveAudio] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    async function fetchReport() {
      try {
        const res = await fetch(`/api/reports/${id}`);
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();
        setReport(data.report);
        setPhotos(data.photos || []);
        setVoiceNotes(data.voiceNotes || []);
        setStatus('loaded');
      } catch {
        setStatus('error');
      }
    }
    if (id) fetchReport();
  }, [id]);

  const handlePlayVoiceNote = (note: VoiceNote) => {
    if (!note.file_url) return;
    if (activeAudio === note.id) {
      audioRef.current?.pause();
      setActiveAudio(null);
      return;
    }
    if (audioRef.current) {
      audioRef.current.pause();
    }
    const audio = new Audio(note.file_url);
    audio.onended = () => setActiveAudio(null);
    audio.play();
    audioRef.current = audio;
    setActiveAudio(note.id);
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-fv-black text-white flex items-center justify-center">
        <div className="flex items-center gap-3">
          <svg className="animate-spin w-6 h-6 text-fv-blue" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span>Loading report...</span>
        </div>
      </div>
    );
  }

  if (status === 'error' || !report) {
    return (
      <div className="min-h-screen bg-fv-black text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-3">Failed to load report</p>
          <button
            onClick={() => router.back()}
            className="text-fv-blue hover:text-fv-blue-light text-sm"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  const reportDate = new Date(report.date);
  const sections = parseReportSections(report.work_status || '');

  return (
    <div className="min-h-screen bg-fv-black text-white">
      {/* Header */}
      <header className="border-b border-fv-gray-800 bg-fv-black/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => router.push('/reports')}
            className="text-fv-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-semibold truncate">
              {report.project_name || 'Daily Report'}
            </h1>
            <p className="text-xs text-fv-gray-400">
              {reportDate.toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Project info card */}
        <div className="bg-gradient-to-br from-fv-blue/10 to-fv-blue/5 border border-fv-blue/20 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-fv-blue/20 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-fv-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div>
              <h2 className="font-semibold text-white">{report.project_name}</h2>
              {report.project_address && (
                <p className="text-sm text-fv-gray-400 mt-0.5">{report.project_address}</p>
              )}
              <p className="text-xs text-fv-gray-500 mt-1">
                Generated {new Date(report.created_at).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </p>
            </div>
          </div>
        </div>

        {/* AI context badges */}
        {report.ai_context && (() => {
          try {
            const ctx = JSON.parse(report.ai_context);
            const badges = [];
            if (ctx.photo_count > 0) badges.push(`${ctx.photo_count} photos`);
            if (ctx.voice_note_count > 0) badges.push(`${ctx.voice_note_count} voice notes`);
            if (ctx.log_entry_count > 0) badges.push(`${ctx.log_entry_count} log entries`);
            if (ctx.note_count > 0) badges.push(`${ctx.note_count} notes`);
            if (badges.length === 0) return null;
            return (
              <div className="flex flex-wrap gap-2">
                <span className="text-xs text-fv-gray-500 py-1">AI analyzed:</span>
                {badges.map((b, i) => (
                  <span key={i} className="text-xs bg-fv-gray-800 text-fv-gray-300 px-2.5 py-1 rounded-full">
                    {b}
                  </span>
                ))}
              </div>
            );
          } catch {
            return null;
          }
        })()}

        {/* Report sections */}
        {sections.map((section, i) => (
          <div key={i} className="bg-fv-gray-800/50 border border-fv-gray-700/50 rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-fv-gray-700/50 bg-fv-gray-800/30">
              <svg className="w-4 h-4 text-fv-blue flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={getSectionIcon(section.title)} />
              </svg>
              <h3 className="text-sm font-semibold text-fv-blue uppercase tracking-wide">
                {section.title}
              </h3>
            </div>
            <div className="px-4 py-3">
              <div className="text-sm text-fv-gray-300 leading-relaxed whitespace-pre-wrap">
                {section.content.split('\n').map((line, j) => {
                  // Render bullet points and content
                  const trimmed = line.trim();
                  if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                    return (
                      <div key={j} className="flex gap-2 mb-1.5">
                        <span className="text-fv-blue mt-0.5 flex-shrink-0">&#x2022;</span>
                        <span>{trimmed.slice(2)}</span>
                      </div>
                    );
                  }
                  if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
                    return (
                      <p key={j} className="font-semibold text-white mt-2 mb-1">
                        {trimmed.replace(/\*\*/g, '')}
                      </p>
                    );
                  }
                  if (trimmed === '') return <div key={j} className="h-2" />;
                  return <p key={j} className="mb-1">{trimmed}</p>;
                })}
              </div>
            </div>
          </div>
        ))}

        {/* Photos section */}
        {photos.length > 0 && (
          <div className="bg-fv-gray-800/50 border border-fv-gray-700/50 rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-fv-gray-700/50 bg-fv-gray-800/30">
              <svg className="w-4 h-4 text-fv-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <h3 className="text-sm font-semibold text-fv-blue uppercase tracking-wide">
                Site Photos ({photos.length})
              </h3>
            </div>
            <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
              {photos.map((photo) => (
                <div key={photo.id} className="aspect-[4/3] rounded-lg overflow-hidden bg-fv-gray-700">
                  {photo.file_url ? (
                    <img
                      src={photo.file_url}
                      alt="Site photo"
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : photo.thumbnail_url ? (
                    <img
                      src={photo.thumbnail_url}
                      alt="Site photo"
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-fv-gray-500">
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Voice notes section */}
        {voiceNotes.length > 0 && (
          <div className="bg-fv-gray-800/50 border border-fv-gray-700/50 rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-fv-gray-700/50 bg-fv-gray-800/30">
              <svg className="w-4 h-4 text-fv-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
              <h3 className="text-sm font-semibold text-fv-blue uppercase tracking-wide">
                Voice Notes ({voiceNotes.length})
              </h3>
            </div>
            <div className="p-4 space-y-3">
              {voiceNotes.map((note) => (
                <div key={note.id} className="flex items-start gap-3 p-3 bg-fv-gray-800/50 rounded-lg">
                  {note.file_url && (
                    <button
                      onClick={() => handlePlayVoiceNote(note)}
                      className="w-10 h-10 rounded-full bg-fv-blue/20 hover:bg-fv-blue/30 flex items-center justify-center flex-shrink-0 transition-colors"
                    >
                      {activeAudio === note.id ? (
                        <svg className="w-4 h-4 text-fv-blue" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 text-fv-blue ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      )}
                    </button>
                  )}
                  <div className="min-w-0 flex-1">
                    {note.transcript && (
                      <p className="text-sm text-fv-gray-300 leading-relaxed">{note.transcript}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1 text-xs text-fv-gray-500">
                      {note.duration && <span>{formatDuration(note.duration)}</span>}
                      <span>{new Date(note.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bottom spacer for PWA safe area */}
        <div className="h-8" />
      </main>
    </div>
  );
}
