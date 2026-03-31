"use client";

interface RecipePreviewProps {
  markdown: string;
}

export function RecipePreview({ markdown }: RecipePreviewProps) {
  return (
    <div className="w-full border border-gray-700 rounded p-6 bg-gray-900/50">
      <pre className="whitespace-pre-wrap font-mono text-sm text-gray-200 leading-relaxed">
        {markdown}
      </pre>
    </div>
  );
}
