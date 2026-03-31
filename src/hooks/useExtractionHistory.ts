"use client";

import { useLocalStorage } from "./useLocalStorage";
import { ExtractionHistoryEntry } from "@/lib/types";

const MAX_HISTORY = 20;

export function useExtractionHistory() {
  const [history, setHistory] = useLocalStorage<ExtractionHistoryEntry[]>(
    "recentExtractions",
    []
  );

  const addEntry = (entry: ExtractionHistoryEntry) => {
    setHistory((prev) => [entry, ...prev].slice(0, MAX_HISTORY));
  };

  const clearHistory = () => {
    setHistory([]);
  };

  return { history, addEntry, clearHistory };
}
