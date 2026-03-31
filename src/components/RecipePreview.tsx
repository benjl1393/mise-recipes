"use client";

interface RecipePreviewProps {
  markdown: string;
}

export function RecipePreview({ markdown }: RecipePreviewProps) {
  return (
    <div className="w-full border border-border bg-surface p-6 md:p-8">
      <pre className="whitespace-pre-wrap font-body text-[14px] text-text leading-[1.6]">
        {markdown}
      </pre>
    </div>
  );
}
