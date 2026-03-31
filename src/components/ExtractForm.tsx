"use client";

import { useState, useRef } from "react";
import { UnitPreference } from "@/lib/types";

interface ExtractFormProps {
  units: UnitPreference;
  onExtract: (result: { recipe: Record<string, unknown>; markdown: string }) => void;
  onError: (error: string) => void;
  onInstagramPaste: () => void;
}

export function ExtractForm({ units, onExtract, onError, onInstagramPaste }: ExtractFormProps) {
  const [url, setUrl] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPaste, setShowPaste] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmitUrl = async () => {
    if (!url.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), units }),
      });
      const data = await res.json();

      if (data.error === "instagram_paste_needed") {
        setShowPaste(true);
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

  const handleSubmitPaste = async () => {
    if (!pasteText.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: pasteText.trim(), units }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onExtract(data);
      setShowPaste(false);
      setPasteText("");
    } catch (err) {
      onError(err instanceof Error ? err.message : "Extraction failed");
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      onError("Image must be under 5MB");
      return;
    }

    setLoading(true);
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64, units }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onExtract(data);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Extraction failed");
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="w-full space-y-4">
      <div className="flex gap-2">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Paste a recipe URL..."
          className="flex-1 px-4 py-3 bg-transparent border border-gray-600 rounded text-white placeholder-gray-500 focus:outline-none focus:border-white"
          onKeyDown={(e) => e.key === "Enter" && handleSubmitUrl()}
          disabled={loading}
        />
        <button
          onClick={handleSubmitUrl}
          disabled={loading || !url.trim()}
          className="px-6 py-3 bg-white text-black font-bold rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "..." : "Extract"}
        </button>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={loading}
          className="px-4 py-2 text-sm border border-gray-600 rounded text-gray-300 hover:text-white hover:border-white disabled:opacity-50"
        >
          Upload photo
        </button>
        <span className="text-xs text-gray-500">JPG, PNG, or HEIC — max 5MB</span>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/heic,image/webp"
          onChange={handleImageUpload}
          className="hidden"
        />
      </div>

      {showPaste && (
        <div className="space-y-2">
          <p className="text-sm text-gray-400">Paste the recipe text or Instagram caption below:</p>
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            rows={6}
            className="w-full px-4 py-3 bg-transparent border border-gray-600 rounded text-white placeholder-gray-500 focus:outline-none focus:border-white resize-y"
            placeholder="Paste recipe text here..."
          />
          <button
            onClick={handleSubmitPaste}
            disabled={loading || !pasteText.trim()}
            className="px-6 py-2 bg-white text-black font-bold rounded hover:bg-gray-200 disabled:opacity-50"
          >
            {loading ? "..." : "Extract from text"}
          </button>
        </div>
      )}

      {!showPaste && (
        <button
          onClick={() => setShowPaste(true)}
          className="text-sm text-gray-500 hover:text-gray-300 underline"
        >
          Or paste text manually
        </button>
      )}
    </div>
  );
}
