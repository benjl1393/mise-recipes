"use client";

import { ExtractionHistoryEntry } from "@/lib/types";

interface RecentExtractionsProps {
  history: ExtractionHistoryEntry[];
  onSelect: (entry: ExtractionHistoryEntry) => void;
  onClear: () => void;
}

export function RecentExtractions({ history, onSelect, onClear }: RecentExtractionsProps) {
  if (history.length === 0) return null;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wide">Recent</h2>
        <button onClick={onClear} className="text-xs text-gray-600 hover:text-gray-400">Clear</button>
      </div>
      <ul className="space-y-1">
        {history.map((entry, i) => (
          <li key={`${entry.date}-${i}`}>
            <button
              onClick={() => onSelect(entry)}
              className="w-full text-left px-3 py-2 rounded hover:bg-gray-800/50 text-sm"
            >
              <span className="text-gray-200">{entry.title}</span>
              <span className="text-gray-600 ml-2 text-xs">{new Date(entry.date).toLocaleDateString()}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
