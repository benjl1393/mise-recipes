interface OEmbedResponse {
  title?: string;
  author_name?: string;
  html?: string;
  [key: string]: unknown;
}

export function buildOEmbedUrl(postUrl: string): string {
  const encoded = encodeURIComponent(postUrl);
  return `https://graph.facebook.com/v18.0/instagram_oembed?url=${encoded}&access_token=&maxwidth=658`;
}

export function parseOEmbedCaption(response: OEmbedResponse): string | null {
  return response.title ?? null;
}

export async function fetchInstagramContent(url: string): Promise<{
  caption: string | null;
  needsManualPaste: boolean;
}> {
  try {
    const oembedUrl = buildOEmbedUrl(url);
    const response = await fetch(oembedUrl);

    if (!response.ok) {
      return { caption: null, needsManualPaste: true };
    }

    const data: OEmbedResponse = await response.json();
    const caption = parseOEmbedCaption(data);

    if (!caption) {
      return { caption: null, needsManualPaste: true };
    }

    return { caption, needsManualPaste: false };
  } catch {
    return { caption: null, needsManualPaste: true };
  }
}
