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

export type UnitPreference = "metric" | "imperial";

export interface ExtractionRequest {
  url?: string;
  image?: string; // base64
  text?: string; // manual paste
  units: UnitPreference;
}

export interface ExtractionHistoryEntry {
  title: string;
  source: string;
  date: string; // ISO string
  markdown: string;
}
