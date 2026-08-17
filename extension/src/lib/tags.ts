/** The opinionated v1 taxonomy — docs/mise-md-format.md § Taxonomy. */
export const TAXONOMY = {
  cuisine: "#cuisine/* — korean, italian, french, japanese, mexican, …",
  ingredient:
    "#pork #chicken #beef #fish #lamb #egg #tofu #mushroom #legume #grain #vegetable",
  technique:
    "#braise #grill #roast #stir-fry #raw #bake #no-cook #pressure #slow #steam #deep-fry",
  time: "#weeknight #weekend #make-ahead",
  dietary:
    "#vegetarian #vegan #gluten-free #dairy-free #nut-free (only when confidently true)",
} as const;

/** Mise targets 3–5 tags per recipe. */
const MAX_TAGS = 5;

/** Minutes of hands-on time at or below which a recipe is a #weeknight. */
const WEEKNIGHT_CEILING_MINUTES = 45;

function kebab(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2") // slowCooker -> slow-Cooker
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Lowercase, kebab-case, namespace-preserving. Returns "" if nothing survives. */
export function sanitizeTag(raw: string): string {
  const bare = raw.trim().replace(/^#/, "");
  if (!bare) return "";
  const slash = bare.indexOf("/");
  if (slash === -1) {
    const value = kebab(bare);
    return value ? `#${value}` : "";
  }
  const ns = kebab(bare.slice(0, slash));
  const value = kebab(bare.slice(slash + 1));
  if (!ns || !value) return "";
  return `#${ns}/${value}`;
}

/** Parse "1h 10m" / "25m" / "2h" into minutes. Returns null if unparseable. */
export function parseDuration(value: string): number | null {
  const match = value.trim().match(/^(?:(\d+)\s*h)?\s*(?:(\d+)\s*m)?$/i);
  if (!match || (!match[1] && !match[2])) return null;
  return Number(match[1] ?? 0) * 60 + Number(match[2] ?? 0);
}

/**
 * Sanitize, dedupe, apply the #weeknight time bucket, and cap at five.
 * Time-bucket tags are computed here rather than trusted from the model.
 */
export function normalizeTags(raw: string[], handsOn?: string): string[] {
  const out: string[] = [];
  for (const tag of raw) {
    const clean = sanitizeTag(tag);
    if (clean && !out.includes(clean)) out.push(clean);
  }

  if (handsOn) {
    const minutes = parseDuration(handsOn);
    if (
      minutes !== null &&
      minutes <= WEEKNIGHT_CEILING_MINUTES &&
      !out.includes("#weeknight")
    ) {
      out.push("#weeknight");
    }
  }

  return out.slice(0, MAX_TAGS);
}
