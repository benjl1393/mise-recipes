import { SourceType } from "./types";

export function detectSource(url: string): SourceType {
  const hostname = new URL(url).hostname.replace("www.", "");

  if (hostname === "youtube.com" || hostname === "youtu.be") {
    return "youtube";
  }

  if (hostname === "instagram.com") {
    return "instagram";
  }

  return "web";
}
