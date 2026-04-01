"use client";

import { useState, useRef } from "react";
import { UnitPreference, ServingCount, SERVING_OPTIONS } from "@/lib/types";

interface ExtractFormProps {
  onExtract: (result: {
    recipe: Record<string, unknown>;
    markdown: string;
  }) => void;
  onError: (error: string) => void;
  onInstagramPaste: () => void;
  onLoadingChange: (loading: boolean) => void;
}

type SourceMode = "url" | "photo" | "paste";

export function ExtractForm({
  onExtract,
  onError,
  onInstagramPaste,
  onLoadingChange,
}: ExtractFormProps) {
  const [sourceMode, setSourceMode] = useState<SourceMode>("url");
  const [url, setUrl] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [imageData, setImageData] = useState<string | null>(null);
  const [units, setUnits] = useState<UnitPreference>("metric");
  const [servings, setServings] = useState<ServingCount>(null);
  const [loadingState, setLoadingState] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const setLoading = (val: boolean) => {
    setLoadingState(val);
    onLoadingChange(val);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      onError("Image must be under 5MB");
      return;
    }

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => setImageData(reader.result as string);
    reader.readAsDataURL(file);
  };

  const canSubmit = () => {
    if (loadingState) return false;
    if (sourceMode === "url") return url.trim().length > 0;
    if (sourceMode === "photo") return imageData !== null;
    if (sourceMode === "paste") return pasteText.trim().length > 0;
    return false;
  };

  const handleSubmit = async () => {
    if (!canSubmit()) return;

    // Instagram doesn't allow automatic extraction — skip the API call
    if (sourceMode === "url") {
      try {
        const hostname = new URL(url.trim()).hostname.replace("www.", "");
        if (hostname === "instagram.com") {
          setSourceMode("paste");
          onInstagramPaste();
          return;
        }
      } catch {
        // Invalid URL — let the API handle validation
      }
    }

    setLoading(true);

    try {
      const payload: Record<string, unknown> = { units, servings };

      if (sourceMode === "url") {
        payload.url = url.trim();
      } else if (sourceMode === "photo") {
        payload.image = imageData;
      } else {
        payload.text = pasteText.trim();
      }

      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (data.error === "instagram_paste_needed") {
        setSourceMode("paste");
        onInstagramPaste();
        return;
      }

      if (!res.ok) throw new Error(data.error);
      onExtract(data);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Extraction failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full space-y-8">
      {/* Step 1: Source */}
      <div>
        <p className="font-[family-name:var(--font-pixel)] text-[11px] uppercase tracking-[0.2em] text-gray mb-4">
          01 — Source
        </p>

        <div className="flex gap-2 mb-4">
          {(["url", "photo", "paste"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setSourceMode(mode)}
              disabled={loadingState}
              className={`px-3 py-2 text-[11px] font-[family-name:var(--font-pixel)] uppercase tracking-[0.12em] border transition-colors ${
                sourceMode === mode
                  ? "bg-black text-white border-black"
                  : "bg-transparent text-gray border-black/20 hover:text-black hover:border-black"
              }`}
            >
              {mode === "url" ? "URL" : mode === "photo" ? "Photo" : "Paste"}
            </button>
          ))}
        </div>

        {sourceMode === "url" && (
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste a recipe URL..."
            aria-label="Recipe URL"
            className="w-full px-4 py-3 bg-white border border-black text-black placeholder-gray text-[14px] focus:outline-none focus-visible:ring-2 focus-visible:ring-black transition-colors"
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            disabled={loadingState}
          />
        )}

        {sourceMode === "photo" && (
          <div className="flex items-center gap-4">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={loadingState}
              className="px-4 py-3 font-[family-name:var(--font-pixel)] text-[11px] uppercase tracking-[0.12em] border border-black text-black hover:bg-black hover:text-white disabled:opacity-30 transition-colors"
            >
              {fileName ? "Change" : "Choose file"}
            </button>
            <span className="text-[12px] text-gray truncate">
              {fileName || "JPG, PNG, or HEIC — max 5MB"}
            </span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/heic,image/webp"
              onChange={handleImageSelect}
              className="hidden"
            />
          </div>
        )}

        {sourceMode === "paste" && (
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            rows={5}
            aria-label="Recipe text"
            className="w-full px-4 py-3 bg-white border border-black text-black placeholder-gray text-[14px] focus:outline-none focus-visible:ring-2 focus-visible:ring-black resize-y transition-colors"
            placeholder="Paste recipe text here..."
            disabled={loadingState}
          />
        )}
      </div>

      {/* Step 2: Units */}
      <div>
        <p className="font-[family-name:var(--font-pixel)] text-[11px] uppercase tracking-[0.2em] text-gray mb-4">
          02 — Units
        </p>
        <div className="flex gap-2">
          {(["metric", "imperial", "both"] as const).map((u) => (
            <button
              key={u}
              onClick={() => setUnits(u)}
              disabled={loadingState}
              className={`px-3 py-2 text-[11px] font-[family-name:var(--font-pixel)] uppercase tracking-[0.12em] border transition-colors ${
                units === u
                  ? "bg-black text-white border-black"
                  : "bg-transparent text-gray border-black/20 hover:text-black hover:border-black"
              }`}
            >
              {u}
            </button>
          ))}
        </div>
      </div>

      {/* Step 3: Servings */}
      <div>
        <p className="font-[family-name:var(--font-pixel)] text-[11px] uppercase tracking-[0.2em] text-gray mb-4">
          03 — Servings <span className="text-gray/50">(optional)</span>
        </p>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setServings(servings === null ? SERVING_OPTIONS[0] : null)}
            disabled={loadingState}
            className={`shrink-0 px-3 py-2 text-[11px] font-[family-name:var(--font-pixel)] uppercase tracking-[0.12em] border transition-colors ${
              servings === null
                ? "bg-black text-white border-black"
                : "bg-transparent text-gray border-black/20 hover:text-black hover:border-black"
            }`}
          >
            Original
          </button>
          <div className={`flex-1 ${servings === null ? "opacity-30 pointer-events-none" : ""}`}>
            <input
              type="range"
              min={0}
              max={SERVING_OPTIONS.length - 1}
              step={1}
              value={servings === null ? 0 : SERVING_OPTIONS.indexOf(servings as (typeof SERVING_OPTIONS)[number])}
              onChange={(e) => setServings(SERVING_OPTIONS[Number(e.target.value)])}
              disabled={loadingState || servings === null}
              className="w-full h-[2px] bg-black/20 appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-black [&::-webkit-slider-thumb]:border-0 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:bg-black [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:rounded-none [&::-webkit-slider-thumb]:rounded-none"
            />
            <div className="flex justify-between mt-1">
              {SERVING_OPTIONS.map((s) => (
                <span
                  key={s}
                  className={`text-[10px] font-[family-name:var(--font-pixel)] ${
                    servings === s ? "text-black" : "text-gray"
                  }`}
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={!canSubmit()}
        className="w-full py-4 bg-black text-white font-[family-name:var(--font-pixel)] text-[14px] uppercase tracking-[0.15em] hover:bg-gray-dark disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        {loadingState ? "..." : "Print Recipe"}
      </button>
    </div>
  );
}
