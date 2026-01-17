'use client';

import { useState, useCallback } from 'react';
import { LineItem } from '@/lib/supabase/types';
import { TRADE_CATEGORIES } from '@/lib/schedule/trades';

interface LineItemsTableProps {
  items: LineItem[];
  onUpdate: (items: LineItem[]) => Promise<void>;
  onConfirmAll: () => Promise<void>;
  disabled?: boolean;
}

export function LineItemsTable({ items, onUpdate, onConfirmAll, disabled }: LineItemsTableProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [editTrade, setEditTrade] = useState('');

  const confirmedCount = items.filter((i) => i.confirmed).length;

  const handleToggleConfirm = useCallback(async (id: string) => {
    const updated = items.map((item) =>
      item.id === id ? { ...item, confirmed: !item.confirmed } : item
    );
    await onUpdate(updated);
  }, [items, onUpdate]);

  const handleStartEdit = useCallback((item: LineItem) => {
    setEditingId(item.id);
    setEditText(item.text);
    setEditTrade(item.trade || '');
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingId) return;

    const updated = items.map((item) =>
      item.id === editingId ? { ...item, text: editText, trade: editTrade } : item
    );
    await onUpdate(updated);
    setEditingId(null);
  }, [editingId, editText, editTrade, items, onUpdate]);

  const handleCancelEdit = useCallback(() => {
    setEditingId(null);
    setEditText('');
    setEditTrade('');
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  }, [handleSaveEdit, handleCancelEdit]);

  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-fv-gray-500 text-sm">
        Upload a PDF to extract line items
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header with confirm all button */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-fv-gray-400">
          {confirmedCount} of {items.length} confirmed
        </span>
        {confirmedCount < items.length && (
          <button
            onClick={onConfirmAll}
            disabled={disabled}
            className="text-xs text-fv-blue hover:text-fv-blue-light disabled:opacity-50"
          >
            Confirm All
          </button>
        )}
      </div>

      {/* Items list */}
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {items.map((item) => (
          <div
            key={item.id}
            className={`
              p-3 rounded-lg border transition-colors
              ${item.confirmed ? 'bg-green-900/20 border-green-800/50' : 'bg-fv-gray-800 border-fv-gray-700'}
            `}
          >
            {editingId === item.id ? (
              <div className="space-y-2">
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="w-full bg-fv-gray-900 border border-fv-gray-600 rounded px-2 py-1 text-sm text-white focus:border-fv-blue focus:outline-none resize-none"
                  rows={2}
                  autoFocus
                />
                <div className="flex items-center gap-2">
                  <select
                    value={editTrade}
                    onChange={(e) => setEditTrade(e.target.value)}
                    className="flex-1 bg-fv-gray-900 border border-fv-gray-600 rounded px-2 py-1 text-xs text-white focus:border-fv-blue focus:outline-none"
                  >
                    <option value="">Select trade...</option>
                    {TRADE_CATEGORIES.map((trade) => (
                      <option key={trade} value={trade}>{trade}</option>
                    ))}
                  </select>
                  <button
                    onClick={handleSaveEdit}
                    className="px-2 py-1 bg-fv-blue text-white text-xs rounded hover:bg-fv-blue-light"
                  >
                    Save
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="px-2 py-1 bg-fv-gray-700 text-white text-xs rounded hover:bg-fv-gray-600"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3">
                {/* Checkbox */}
                <button
                  onClick={() => handleToggleConfirm(item.id)}
                  disabled={disabled}
                  className={`
                    mt-0.5 w-5 h-5 rounded border flex items-center justify-center transition-colors
                    ${item.confirmed ? 'bg-green-600 border-green-600' : 'border-fv-gray-600 hover:border-fv-blue'}
                    disabled:opacity-50
                  `}
                >
                  {item.confirmed && (
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white">{item.text}</p>
                  {item.trade && (
                    <span className="inline-block mt-1 px-2 py-0.5 bg-fv-gray-700 text-fv-gray-300 text-xs rounded">
                      {item.trade}
                    </span>
                  )}
                </div>

                {/* Edit button */}
                <button
                  onClick={() => handleStartEdit(item)}
                  disabled={disabled}
                  className="p-1 text-fv-gray-500 hover:text-white disabled:opacity-50"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
