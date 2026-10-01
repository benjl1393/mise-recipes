import {
  CUSTOM_DEFAULTS,
  normalizeBaseURL,
  PRESETS,
  type Preset,
  type PresetId,
  type Protocol,
  type ProviderId,
  type Tier,
} from "./presets";
import type { ErrorContext } from "./errors";

/** The slice of Settings a connection is built from. */
export interface ConnectionSettings {
  apiKey: string;
  provider: ProviderId;
  tier: Tier;
  baseURL: string;
  customModel: string;
}

/** Everything an adapter needs, and nothing it would have to look up. */
export interface Connection {
  provider: ProviderId;
  label: string;
  host: string;
  protocol: Protocol;
  baseURL: string;
  apiKey: string;
  model: string;
  maxImages: number;
  tokenParam: Preset["tokenParam"];
  strict: boolean;
  extraBody: Record<string, unknown>;
}

export interface ModelRequest {
  prompt: string;
  /** Already sampled to the connection's maxImages. */
  frames: string[];
  schema: object;
  maxTokens: number;
}

export const CUSTOM_LABEL = "Your provider";

const MISSING_CUSTOM = "A custom provider needs a base URL and a model ID. Open Prep to add them.";

export function resolveConnection(s: ConnectionSettings): Connection {
  const apiKey = s.apiKey.trim();

  if (s.provider === "custom") {
    const baseURL = normalizeBaseURL(s.baseURL);
    const model = s.customModel.trim();
    let host = "";
    try {
      const url = new URL(baseURL);
      if (url.protocol === "http:" || url.protocol === "https:") host = url.host;
    } catch {
      host = "";
    }
    if (!host || !model) throw new Error(MISSING_CUSTOM);
    return {
      provider: "custom",
      label: CUSTOM_LABEL,
      host,
      protocol: CUSTOM_DEFAULTS.protocol,
      baseURL,
      apiKey,
      model,
      maxImages: CUSTOM_DEFAULTS.maxImages,
      tokenParam: CUSTOM_DEFAULTS.tokenParam,
      strict: CUSTOM_DEFAULTS.strict,
      extraBody: {},
    };
  }

  // A corrupted stored id falls back to Anthropic rather than crashing the popup.
  const p = PRESETS[s.provider as PresetId] ?? PRESETS.anthropic;
  return {
    provider: p.id,
    label: p.label,
    host: p.host,
    protocol: p.protocol,
    baseURL: p.baseURL,
    apiKey,
    model: p.models[s.tier] ?? p.models.fast,
    maxImages: p.maxImages,
    tokenParam: p.tokenParam,
    strict: p.strict,
    extraBody: structuredClone(p.extraBody),
  };
}

export function endpointOf(c: Connection): string {
  return c.protocol === "anthropic"
    ? "https://api.anthropic.com/v1/messages"
    : `${c.baseURL}/chat/completions`;
}

export function contextOf(c: Connection): ErrorContext {
  return {
    label: c.label,
    host: c.host,
    model: c.model,
    custom: c.provider === "custom",
    url: endpointOf(c),
  };
}
