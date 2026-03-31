"use client";

import { useState } from "react";
import { ExtractForm } from "@/components/ExtractForm";
import { RecipePreview } from "@/components/RecipePreview";
import { DownloadButton } from "@/components/DownloadButton";
import { RecentExtractions } from "@/components/RecentExtractions";
import { UnitToggle } from "@/components/UnitToggle";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useExtractionHistory } from "@/hooks/useExtractionHistory";
import { UnitPreference, ExtractionHistoryEntry } from "@/lib/types";

export default function Home() {
  const [units, setUnits] = useLocalStorage<UnitPreference>("unitPreference", "metric");
  const { history, addEntry, clearHistory } = useExtractionHistory();
  const [currentMarkdown, setCurrentMarkdown] = useState<string | null>(null);
  const [currentTitle, setCurrentTitle] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const handleExtract = (result: { recipe: Record<string, unknown>; markdown: string }) => {
    setCurrentMarkdown(result.markdown);
    setCurrentTitle(result.recipe.title as string);
    setError(null);

    addEntry({
      title: result.recipe.title as string,
      source: result.recipe.source as string,
      date: new Date().toISOString(),
      markdown: result.markdown,
    });
  };

  const handleSelectHistory = (entry: ExtractionHistoryEntry) => {
    setCurrentMarkdown(entry.markdown);
    setCurrentTitle(entry.title);
    setError(null);
  };

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="max-w-2xl mx-auto px-4 py-12 space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Recipe Archiver</h1>
          <UnitToggle value={units} onChange={setUnits} />
        </div>

        <ExtractForm
          units={units}
          onExtract={handleExtract}
          onError={(msg) => { setError(msg); setCurrentMarkdown(null); }}
          onInstagramPaste={() => setError(null)}
        />

        {error && (
          <div className="px-4 py-3 border border-red-800 rounded text-red-400 text-sm">{error}</div>
        )}

        {currentMarkdown && (
          <div className="space-y-4">
            <RecipePreview markdown={currentMarkdown} />
            <DownloadButton markdown={currentMarkdown} title={currentTitle} />
          </div>
        )}

        <RecentExtractions history={history} onSelect={handleSelectHistory} onClear={clearHistory} />
      </div>
    </main>
  );
}
