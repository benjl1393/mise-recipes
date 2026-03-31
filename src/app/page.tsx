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
  const [units, setUnits] = useLocalStorage<UnitPreference>(
    "unitPreference",
    "metric"
  );
  const { history, addEntry, clearHistory } = useExtractionHistory();
  const [currentMarkdown, setCurrentMarkdown] = useState<string | null>(null);
  const [currentTitle, setCurrentTitle] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const handleExtract = (result: {
    recipe: Record<string, unknown>;
    markdown: string;
  }) => {
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
    <main className="min-h-screen">
      <div className="max-w-2xl mx-auto px-4 py-16 space-y-10">
        {/* Header — Gorton embossed label */}
        <header>
          <div className="flex items-end justify-between mb-3">
            <h1
              className="font-[family-name:var(--font-open-gorton)] text-[32px] md:text-[40px] uppercase tracking-[0.12em] leading-none text-navy"
            >
              Recipe Archiver
            </h1>
            <UnitToggle value={units} onChange={setUnits} />
          </div>
          <p className="text-[11px] text-text-secondary uppercase tracking-[0.2em] font-medium">
            Paste a URL. Upload a photo. Get the recipe.
          </p>
        </header>

        {/* Steel divider */}
        <div className="h-px bg-border" />

        {/* Extract Form */}
        <ExtractForm
          units={units}
          onExtract={handleExtract}
          onError={(msg) => {
            setError(msg);
            setCurrentMarkdown(null);
          }}
          onInstagramPaste={() => setError(null)}
        />

        {/* Error — LED red */}
        {error && (
          <div className="px-4 py-3 border-l-2 border-led bg-led/5 text-led text-[13px]">
            {error}
          </div>
        )}

        {/* Preview + Download */}
        {currentMarkdown && (
          <div className="space-y-6">
            <div className="h-px bg-border" />
            <RecipePreview markdown={currentMarkdown} />
            <DownloadButton markdown={currentMarkdown} title={currentTitle} />
          </div>
        )}

        {/* History */}
        {history.length > 0 && (
          <>
            <div className="h-px bg-border" />
            <RecentExtractions
              history={history}
              onSelect={handleSelectHistory}
              onClear={clearHistory}
            />
          </>
        )}
      </div>
    </main>
  );
}
