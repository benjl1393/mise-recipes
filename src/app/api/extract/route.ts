import { NextRequest, NextResponse } from "next/server";
import { detectSource } from "@/lib/source-detect";
import { fetchAndExtract } from "@/lib/extractors/web";
import { fetchYoutubeContent } from "@/lib/extractors/youtube";
import { fetchInstagramContent } from "@/lib/extractors/instagram";
import { parseRecipeFromText, parseRecipeFromImage } from "@/lib/llm";
import { recipeToMarkdown } from "@/lib/markdown";
import { RateLimiter } from "@/lib/rate-limit";
import { UnitPreference } from "@/lib/types";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

const rateLimiter = new RateLimiter({
  maxRequests: 10,
  windowMs: 60 * 60 * 1000, // 1 hour
});

interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateRequest(body: Record<string, unknown>): ValidationResult {
  const { url, image, text, units } = body;

  if (!url && !image && !text) {
    return { valid: false, error: "Must provide url, image, or text" };
  }

  if (units !== "metric" && units !== "imperial") {
    return { valid: false, error: "units must be 'metric' or 'imperial'" };
  }

  if (typeof image === "string" && image.length > MAX_IMAGE_SIZE) {
    return { valid: false, error: "Image must be under 5MB" };
  }

  return { valid: true };
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rateCheck = rateLimiter.check(ip);

  if (!rateCheck.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded. Try again later." }, { status: 429 });
  }

  const body = await request.json();
  const validation = validateRequest(body);

  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const units: UnitPreference = body.units;

  try {
    // Image path
    if (body.image) {
      const base64Match = (body.image as string).match(/^data:(image\/\w+);base64,(.+)$/);
      if (!base64Match) {
        return NextResponse.json({ error: "Invalid image format. Expected base64 data URI." }, { status: 400 });
      }

      const mediaType = base64Match[1] as "image/jpeg" | "image/png" | "image/webp" | "image/gif";
      const imageData = base64Match[2];

      const recipe = await parseRecipeFromImage(imageData, mediaType, units);
      recipe.source = "Photo upload";
      const markdown = recipeToMarkdown(recipe);
      return NextResponse.json({ recipe, markdown });
    }

    // Text paste path
    if (body.text) {
      const recipe = await parseRecipeFromText(body.text as string, units);
      recipe.source = "Manual paste";
      const markdown = recipeToMarkdown(recipe);
      return NextResponse.json({ recipe, markdown });
    }

    // URL path
    const url = body.url as string;
    const sourceType = detectSource(url);
    let rawText = "";

    switch (sourceType) {
      case "youtube": {
        rawText = await fetchYoutubeContent(url);
        break;
      }
      case "instagram": {
        const { caption, needsManualPaste } = await fetchInstagramContent(url);
        if (needsManualPaste) {
          return NextResponse.json(
            { error: "instagram_paste_needed", message: "Could not extract from this Instagram post. Please paste the caption text manually." },
            { status: 422 }
          );
        }
        rawText = caption!;
        break;
      }
      case "web": {
        const extraction = await fetchAndExtract(url);
        if (extraction.jsonLd) {
          rawText = "--- STRUCTURED RECIPE DATA ---\n" + JSON.stringify(extraction.jsonLd) + "\n\n--- PAGE CONTENT ---\n" + extraction.textContent;
        } else {
          rawText = extraction.textContent;
        }
        break;
      }
    }

    if (!rawText.trim()) {
      return NextResponse.json({ error: "Could not extract any content from this URL." }, { status: 422 });
    }

    const recipe = await parseRecipeFromText(rawText, units);
    recipe.source = url;
    const markdown = recipeToMarkdown(recipe);

    return NextResponse.json({ recipe, markdown });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Extraction failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
