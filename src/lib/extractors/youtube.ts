import { YoutubeTranscript } from "youtube-transcript";

export function extractVideoId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.replace("www.", "");

    if (hostname === "youtube.com") {
      return parsed.searchParams.get("v");
    }

    if (hostname === "youtu.be") {
      return parsed.pathname.slice(1) || null;
    }

    return null;
  } catch {
    return null;
  }
}

export async function fetchYoutubeContent(url: string): Promise<string> {
  const videoId = extractVideoId(url);
  if (!videoId) throw new Error("Invalid YouTube URL");

  const parts: string[] = [];

  try {
    const transcript = await YoutubeTranscript.fetchTranscript(videoId);
    const transcriptText = transcript.map((t) => t.text).join(" ");
    if (transcriptText) {
      parts.push("--- VIDEO TRANSCRIPT ---");
      parts.push(transcriptText);
    }
  } catch {
    // Transcript may not be available
  }

  try {
    const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; RecipeArchiver/1.0)" },
    });
    const html = await response.text();
    const descMatch = html.match(/<meta\s+name="description"\s+content="([^"]*)"/);
    if (descMatch?.[1]) {
      parts.unshift("--- VIDEO DESCRIPTION ---");
      parts.splice(1, 0, descMatch[1]);
    }
  } catch {
    // Page scrape failed
  }

  if (parts.length === 0) {
    throw new Error("Could not extract any content from this YouTube video");
  }

  return parts.join("\n\n");
}
