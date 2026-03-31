"use client";

interface RecipePreviewProps {
  markdown: string;
}

export function RecipePreview({ markdown }: RecipePreviewProps) {
  return (
    <div className="w-full border border-border bg-surface p-6 md:p-8">
      <pre className="whitespace-pre-wrap font-[family-name:var(--font-body)] text-[13px] text-navy leading-[1.7]">
        {markdown}
      </pre>
    </div>
  );
}
