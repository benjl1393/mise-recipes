/** Controlled extraction-method vocabulary — docs/mise-md-format.md § `via`. */
export type ViaMethod =
  | `${number} video frames`
  | "caption only"
  | "schema data"
  | "article text"
  | "manual paste"
  | "image upload";

export type Units = "metric" | "imperial";

export interface RecipeIngredient {
  /** Quantity with a space between number and unit ("800 g"). Em-dash "—" when unmeasured. */
  qty: string;
  /** Lowercase prose, brief modifiers allowed ("pork belly, skin-on"). */
  item: string;
}

/** The model's extraction output. Maps 1:1 onto the .md body. */
export interface Recipe {
  title: string;
  subtitle?: string;
  serves: string;
  hands_on?: string;
  total?: string;
  ingredients: RecipeIngredient[];
  method: string[];
  notes?: string[];
  tags: string[];
}

/** Capture metadata the extension generates — never the model. */
export interface Frontmatter {
  ticket: number;
  captured: Date;
  source: string;
  via: ViaMethod;
  units?: Units;
  scaled?: number;
}

/** One fired ticket, as stored in the Archive. */
export interface Ticket {
  frontmatter: Omit<Frontmatter, "captured"> & { captured: string };
  recipe: Recipe;
}
