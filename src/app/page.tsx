"use client";

import { useState } from "react";
import { ExtractForm } from "@/components/ExtractForm";
import { RecipePreview } from "@/components/RecipePreview";
import { DownloadButton } from "@/components/DownloadButton";
import { RecentExtractions } from "@/components/RecentExtractions";
import { ProcessingAnimation } from "@/components/ProcessingAnimation";
import { useExtractionHistory } from "@/hooks/useExtractionHistory";
import { ExtractionHistoryEntry } from "@/lib/types";

export default function Home() {
  const { history, addEntry, clearHistory } = useExtractionHistory();
  const [currentMarkdown, setCurrentMarkdown] = useState<string | null>(null);
  const [currentTitle, setCurrentTitle] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleExtract = (result: {
    recipe: Record<string, unknown>;
    markdown: string;
  }) => {
    setCurrentMarkdown(result.markdown);
    setCurrentTitle(result.recipe.title as string);
    setError(null);
    setInfo(null);

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
    <main className="min-h-screen bg-bg">
      <div className="max-w-2xl mx-auto px-4 py-16">
        {/* Header */}
        <header className="mb-10">
          <h1 className="font-[family-name:var(--font-pixel)] text-[36px] md:text-[48px] uppercase tracking-[0.08em] leading-none text-black mb-3">
            Order Up
          </h1>
          <p className="text-[12px] text-gray uppercase tracking-[0.2em]">
            Paste a URL. Upload a photo. Get the recipe.
          </p>
        </header>

        <div className="h-px bg-black/20 mb-10" />

        {/* Extract Form */}
        <ExtractForm
          onExtract={handleExtract}
          onError={(msg) => {
            setError(msg);
            setInfo(null);
            setCurrentMarkdown(null);
          }}
          onInstagramPaste={() => {
            setError(null);
            setInfo("Instagram doesn\u2019t allow automatic extraction. Paste the recipe caption or text below.");
          }}
          onLoadingChange={setLoading}
        />

        {/* Processing animation */}
        {loading && <ProcessingAnimation />}

        {/* Info */}
        {info && (
          <div className="mt-6 px-4 py-3 border-l-2 border-black bg-black/5 text-black text-[13px]" role="status">
            {info}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-6 px-4 py-3 border-l-2 border-led bg-led/5 text-led text-[13px]" role="alert">
            <span className="font-semibold">Error:</span> {error}
          </div>
        )}

        {/* Preview + Download */}
        {currentMarkdown && (
          <div className="mt-10">
            <div className="h-px bg-black/20 mb-6" />
            <RecipePreview markdown={currentMarkdown} />
            <div className="mt-4">
              <DownloadButton markdown={currentMarkdown} title={currentTitle} />
            </div>
          </div>
        )}

        {/* History */}
        {history.length > 0 && (
          <div className="mt-10">
            <div className="h-px bg-black/20 mb-6" />
            <RecentExtractions
              history={history}
              onSelect={handleSelectHistory}
              onClear={clearHistory}
            />
          </div>
        )}
      </div>
    </main>
  );
}
