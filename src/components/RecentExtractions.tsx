"use client";

import { ExtractionHistoryEntry } from "@/lib/types";

interface RecentExtractionsProps {
  history: ExtractionHistoryEntry[];
  onSelect: (entry: ExtractionHistoryEntry) => void;
  onClear: () => void;
}

export function RecentExtractions({
  history,
  onSelect,
  onClear,
}: RecentExtractionsProps) {
  if (history.length === 0) return null;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[10px] font-[family-name:var(--font-pixel)] text-gray uppercase tracking-[0.2em]">
          Recent
        </h2>
        <button
          onClick={onClear}
          className="text-[10px] font-[family-name:var(--font-pixel)] text-gray-light hover:text-led uppercase tracking-[0.12em] transition-colors"
        >
          Clear
        </button>
      </div>
      <ul className="space-y-px">
        {history.map((entry, i) => (
          <li key={`${entry.date}-${i}`}>
            <button
              onClick={() => onSelect(entry)}
              className="w-full text-left px-3 py-2.5 hover:bg-surface-cold text-[13px] transition-colors flex items-baseline justify-between gap-4"
            >
              <span className="text-black truncate">{entry.title}</span>
              <span className="text-gray text-[11px] shrink-0">
                {new Date(entry.date).toLocaleDateString()}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
