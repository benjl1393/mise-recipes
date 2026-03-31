"use client";

interface DownloadButtonProps {
  markdown: string;
  title: string;
}

export function DownloadButton({ markdown, title }: DownloadButtonProps) {
  const handleDownload = () => {
    const filename = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <button onClick={handleDownload} className="px-6 py-3 bg-white text-black font-bold rounded hover:bg-gray-200">
      Download .md
    </button>
  );
}
