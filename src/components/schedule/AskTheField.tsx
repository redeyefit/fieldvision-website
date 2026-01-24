'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface AskTheFieldProps {
  isOpen: boolean;
  onToggle: () => void;
  onAskProject: (question: string) => Promise<string>;
  onAskGeneral: (question: string) => Promise<string>;
  disabled?: boolean;
}

const PROMPT_CHIPS = [
  { label: 'Explain task order', prompt: 'Why are the tasks ordered this way?' },
  { label: 'What\'s missing?', prompt: 'What tasks might be missing from this schedule?' },
  { label: 'Typical duration', prompt: 'What are typical durations for these types of tasks?' },
  { label: 'Best practices', prompt: 'What are best practices for this type of project scheduling?' },
];

export function AskTheField({ isOpen, onToggle, onAskProject, onAskGeneral, disabled }: AskTheFieldProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Ask about this specific project (uses Claude with project context)
  const handleAskProject = useCallback(async (question?: string) => {
    const q = question || input.trim();
    if (!q || isLoading || disabled) return;

    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: `[Project] ${q}` }]);
    setIsLoading(true);

    try {
      const answer = await onAskProject(q);
      setMessages((prev) => [...prev, { role: 'assistant', content: answer }]);
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
        className="absolute right-0 top-1/2 -translate-y-1/2 bg-fv-gray-800 hover:bg-fv-gray-700 text-fv-gray-400 hover:text-white px-2 py-4 rounded-l-lg text-xs font-medium"
        style={{ writingMode: 'vertical-rl' }}
      >
        Ask the Field
      </button>
    );
  }

  return (
    <div className="absolute right-0 top-0 bottom-0 w-80 bg-fv-gray-900 border-l border-fv-gray-800 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-fv-gray-800">
        <h3 className="font-medium text-white">Ask the Field</h3>
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
              I can explain your schedule, suggest improvements, and answer questions. I won&apos;t make changes directly - you&apos;re in control.
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
            <div
              key={i}
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
      <div className="p-4 border-t border-fv-gray-800">
        <div className="flex flex-col gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question..."
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
