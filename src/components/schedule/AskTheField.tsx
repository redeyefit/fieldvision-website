'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { ValidatedOperation, AskResponse } from '@/lib/supabase/types';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  modification?: {
    reasoning: string;
    operations: ValidatedOperation[];
    warnings: string[];
  };
  modificationApplied?: boolean;
}

interface AskTheFieldProps {
  isOpen: boolean;
  onToggle: () => void;
  onAskProject: (question: string) => Promise<AskResponse>;
  onAskGeneral: (question: string) => Promise<string>;
  onApplyModification: (operations: ValidatedOperation[]) => Promise<void>;
  disabled?: boolean;
}

const PROMPT_CHIPS = [
  { label: 'Explain task order', prompt: 'Why are the tasks ordered this way?' },
  { label: 'What\'s missing?', prompt: 'What tasks might be missing from this schedule?' },
  { label: 'Typical duration', prompt: 'What are typical durations for these types of tasks?' },
  { label: 'Best practices', prompt: 'What are best practices for this type of project scheduling?' },
];

function ModificationCard({
  modification,
  applied,
  applying,
  onApply,
  onDismiss,
}: {
  modification: NonNullable<Message['modification']>;
  applied?: boolean;
  applying: boolean;
  onApply: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="bg-fv-gray-800/80 border border-fv-gray-600 rounded-lg p-3 space-y-2">
      {/* Reasoning */}
      <p className="text-xs text-fv-gray-300 italic">{modification.reasoning}</p>

      {/* Operations */}
      <div className="space-y-1">
        {modification.operations.map((op, i) => (
          <div key={i} className="flex items-start gap-2 text-xs">
            {op.action === 'add' && (
              <>
                <span className="text-green-400 font-mono font-bold shrink-0">+</span>
                <span className="text-green-300">
                  Add &ldquo;{op.task_name}&rdquo;
                  {op.changes.duration_days && ` (${op.changes.duration_days.to} days)`}
                  {op.changes.trade && ` [${op.changes.trade.to}]`}
                </span>
              </>
            )}
            {op.action === 'update' && (
              <>
                <span className="text-yellow-400 font-mono font-bold shrink-0">~</span>
                <span className="text-yellow-300">
                  Update &ldquo;{op.task_name}&rdquo;:{' '}
                  {Object.entries(op.changes).map(([key, change], j) => (
                    <span key={key}>
                      {j > 0 && ', '}
                      {key} {String(change.from)} &rarr; {String(change.to)}
                    </span>
                  ))}
                </span>
              </>
            )}
            {op.action === 'delete' && (
              <>
                <span className="text-red-400 font-mono font-bold shrink-0">&minus;</span>
                <span className="text-red-300">
                  Remove &ldquo;{op.task_name}&rdquo;
                </span>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Warnings */}
      {modification.warnings.length > 0 && (
        <div className="space-y-0.5">
          {modification.warnings.map((w, i) => (
            <p key={i} className="text-xs text-amber-400/80 flex items-start gap-1">
              <span className="shrink-0">&#9888;</span>
              <span>{w}</span>
            </p>
          ))}
        </div>
      )}

      {/* Actions */}
      {applied === undefined && (
        <div className="flex gap-2 pt-1">
          <button
            onClick={onApply}
            disabled={applying}
            className="flex-1 px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-xs font-medium rounded disabled:opacity-50 transition-colors flex items-center justify-center gap-1"
          >
            {applying ? (
              <>
                <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Applying...
              </>
            ) : (
              'Apply Changes'
            )}
          </button>
          <button
            onClick={onDismiss}
            disabled={applying}
            className="px-3 py-1.5 bg-fv-gray-700 hover:bg-fv-gray-600 text-fv-gray-300 text-xs font-medium rounded disabled:opacity-50 transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}
      {applied === true && (
        <p className="text-xs text-green-400 font-medium pt-1">Changes applied</p>
      )}
      {applied === false && (
        <p className="text-xs text-fv-gray-500 pt-1">Dismissed</p>
      )}
    </div>
  );
}

export function AskTheField({ isOpen, onToggle, onAskProject, onAskGeneral, onApplyModification, disabled }: AskTheFieldProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [applyingIndex, setApplyingIndex] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Handle applying a modification
  const handleApply = useCallback(async (messageIndex: number) => {
    const message = messages[messageIndex];
    if (!message?.modification) return;

    setApplyingIndex(messageIndex);
    try {
      await onApplyModification(message.modification.operations);
      setMessages((prev) =>
        prev.map((m, i) => i === messageIndex ? { ...m, modificationApplied: true } : m)
      );
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Failed to apply changes: ${(err as Error).message}` },
      ]);
    } finally {
      setApplyingIndex(null);
    }
  }, [messages, onApplyModification]);

  // Handle dismissing a modification
  const handleDismiss = useCallback((messageIndex: number) => {
    setMessages((prev) =>
      prev.map((m, i) => i === messageIndex ? { ...m, modificationApplied: false } : m)
    );
  }, []);

  // Ask about this specific project (uses Claude with project context + tools)
  const handleAskProject = useCallback(async (question?: string) => {
    const q = question || input.trim();
    if (!q || isLoading || disabled) return;

    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: `[Project] ${q}` }]);
    setIsLoading(true);

    try {
      const response = await onAskProject(q);

      if (response.type === 'text') {
        setMessages((prev) => [...prev, { role: 'assistant', content: response.answer }]);
      } else {
        // Modification response — show confirmation card
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: response.answer,
            modification: {
              reasoning: response.reasoning,
              operations: response.operations,
              warnings: response.warnings,
            },
          },
        ]);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, disabled, onAskProject]);

  // Ask general construction questions (uses ChatGPT, no project context)
  const handleAskGeneral = useCallback(async (question?: string) => {
    const q = question || input.trim();
    if (!q || isLoading || disabled) return;

    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: `[General] ${q}` }]);
    setIsLoading(true);

    try {
      const answer = await onAskGeneral(q);
      setMessages((prev) => [...prev, { role: 'assistant', content: answer }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, disabled, onAskGeneral]);

  // Legacy handler for prompt chips (defaults to project context)
  const handleSubmit = useCallback(async (question?: string) => {
    await handleAskProject(question);
  }, [handleAskProject]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);

  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className="absolute right-0 top-1/2 -translate-y-1/2 z-30 bg-gradient-to-l from-fv-blue/30 to-fv-gray-800 hover:from-fv-blue/40 hover:to-fv-gray-700 border-l-2 border-t border-b border-fv-blue/50 text-white hover:text-white px-3 py-6 rounded-l-2xl text-sm font-semibold shadow-xl shadow-fv-blue/20 hover:shadow-fv-blue/30 transition-all duration-200 group"
        style={{ writingMode: 'vertical-rl' }}
      >
        <span className="flex items-center gap-3">
          {/* Sparkle icon */}
          <svg className="w-5 h-5 text-fv-blue group-hover:text-fv-blue-light transition-colors" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 0L14.59 8.41L23 11L14.59 13.59L12 22L9.41 13.59L1 11L9.41 8.41L12 0Z" />
          </svg>
          <span>Ask the Field</span>
        </span>
      </button>
    );
  }

  return (
    <div className="absolute right-0 top-0 bottom-0 w-80 bg-fv-gray-900 border-l border-fv-gray-700 flex flex-col z-40 shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-fv-gray-700 bg-fv-gray-900">
        <h3 className="font-semibold text-white flex items-center gap-2">
          <svg className="w-4 h-4 text-fv-blue" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 0L14.59 8.41L23 11L14.59 13.59L12 22L9.41 13.59L1 11L9.41 8.41L12 0Z" />
          </svg>
          Ask the Field
        </h3>
        <button
          onClick={onToggle}
          className="p-1 text-fv-gray-400 hover:text-white"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center">
            <p className="text-sm text-fv-gray-400 mb-4">
              Ask questions about your schedule, or tell me to add, update, or remove tasks. I&apos;ll show you the changes before applying them.
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {PROMPT_CHIPS.map((chip) => (
                <button
                  key={chip.label}
                  onClick={() => handleSubmit(chip.prompt)}
                  disabled={isLoading || disabled}
                  className="px-3 py-1.5 bg-fv-gray-800 hover:bg-fv-gray-700 text-fv-gray-300 text-xs rounded-full transition-colors disabled:opacity-50"
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message, i) => (
            <div key={i}>
              <div
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`
                    max-w-[85%] px-3 py-2 rounded-lg text-sm
                    ${message.role === 'user'
                      ? 'bg-fv-blue text-white'
                      : 'bg-fv-gray-800 text-fv-gray-200'
                    }
                  `}
                >
                  {message.content}
                </div>
              </div>

              {/* Modification confirmation card */}
              {message.modification && (
                <div className="mt-2">
                  <ModificationCard
                    modification={message.modification}
                    applied={message.modificationApplied}
                    applying={applyingIndex === i}
                    onApply={() => handleApply(i)}
                    onDismiss={() => handleDismiss(i)}
                  />
                </div>
              )}
            </div>
          ))
        )}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-fv-gray-800 text-fv-gray-400 px-3 py-2 rounded-lg text-sm">
              <span className="animate-pulse">Thinking...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick prompts (shown when there are messages) */}
      {messages.length > 0 && (
        <div className="px-4 pb-2 flex flex-wrap gap-1">
          {PROMPT_CHIPS.slice(0, 2).map((chip) => (
            <button
              key={chip.label}
              onClick={() => handleSubmit(chip.prompt)}
              disabled={isLoading || disabled}
              className="px-2 py-1 bg-fv-gray-800 hover:bg-fv-gray-700 text-fv-gray-400 text-xs rounded transition-colors disabled:opacity-50"
            >
              {chip.label}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t border-fv-gray-700 bg-fv-gray-900">
        <div className="flex flex-col gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask or modify the schedule..."
            disabled={isLoading || disabled}
            className="w-full bg-fv-gray-800 border border-fv-gray-700 rounded px-3 py-2 text-sm text-white placeholder:text-fv-gray-500 focus:border-fv-blue focus:outline-none disabled:opacity-50"
          />
          <div className="flex gap-2">
            <button
              onClick={() => handleAskProject()}
              disabled={!input.trim() || isLoading || disabled}
              className="flex-1 px-3 py-2 bg-fv-blue hover:bg-fv-blue-light text-white text-xs font-medium rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              This project
            </button>
            <button
              onClick={() => handleAskGeneral()}
              disabled={!input.trim() || isLoading || disabled}
              className="flex-1 px-3 py-2 bg-fv-gray-700 hover:bg-fv-gray-600 text-white text-xs font-medium rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              General construction
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
