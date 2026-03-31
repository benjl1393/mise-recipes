export interface Recipe {
  title: string;
  source: string;
  servings: string | null;
  prepTime: string | null;
  cookTime: string | null;
  ingredients: string[];
  steps: string[];
  notes: string[];
}

export type SourceType = "youtube" | "instagram" | "web";

export type UnitPreference = "metric" | "imperial" | "both";

export const SERVING_OPTIONS = [2, 4, 6, 8, 12] as const;
export type ServingCount = (typeof SERVING_OPTIONS)[number] | null;

export interface ExtractionRequest {
  url?: string;
  image?: string; // base64
  text?: string; // manual paste
  units: UnitPreference;
  servings?: number | null;
}

export interface ExtractionHistoryEntry {
  title: string;
  source: string;
  date: string; // ISO string
  markdown: string;
}
