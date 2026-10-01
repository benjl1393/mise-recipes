import { describe, it, expect } from "vitest";
import {
  classifyResponse,
  ProviderError,
  readErrorBody,
  type ErrorContext,
} from "../src/lib/providers/errors";

// Bodies as the vendors actually return them (research probes, 2026-10-01).
const OPENAI_401 = {
  error: {
    message: "Incorrect API key provided: sk-x.",
    type: "invalid_request_error",
    param: null,
    code: "invalid_api_key",
  },
};
const GEMINI_400 = [
  {
    error: {
      code: 400,
      message: "API key not valid. Please pass a valid API key.",
      status: "INVALID_ARGUMENT",
    },
  },
];
const XAI_400 = {
  code: "invalid-argument",
  error: "Incorrect API key provided: xa***. You can obtain an API key from https://console.x.ai.",
};
const MISTRAL_401 = { detail: "Invalid API Key" };
const OPENROUTER_402 = { error: { code: 402, message: "Insufficient credits." } };
const ANTHROPIC_LOW_BALANCE = {
  type: "error",
  error: {
    type: "invalid_request_error",
    message:
      "Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits.",
  },
};
const GEMINI_429 = [
  {
    error: {
      code: 429,
      message: "You exceeded your current quota, please check your plan and billing details.",
      status: "RESOURCE_EXHAUSTED",
    },
  },
];
const OPENAI_QUOTA = {
  error: {
    message: "You exceeded your current quota.",
    type: "insufficient_quota",
    code: "insufficient_quota",
  },
};
const OPENAI_STRICT_SCHEMA = {
  error: {
    message:
      "Invalid schema for response_format 'recipe': In context=(), 'required' is required to be supplied and to be an array including every key in properties. Missing 'subtitle'.",
    type: "invalid_request_error",
    code: null,
  },
};

describe("readErrorBody", () => {
  it("reads the OpenAI / OpenRouter / Anthropic shape", () => {
    expect(readErrorBody(OPENAI_401)).toEqual({
      message: OPENAI_401.error.message,
      code: "invalid_api_key",
    });
  });

  it("reads Gemini's array shape", () => {
    expect(readErrorBody(GEMINI_400).message).toMatch(/API key not valid/);
  });

  it("reads xAI's string error", () => {
    expect(readErrorBody(XAI_400)).toEqual({ message: XAI_400.error, code: "invalid-argument" });
  });

  it("reads Mistral's detail", () => {
    expect(readErrorBody(MISTRAL_401).message).toBe("Invalid API Key");
  });

  it("falls back to plain text, clipped to 200 characters", () => {
    expect(readErrorBody("x".repeat(500)).message).toHaveLength(200);
  });
});

describe("classifyResponse", () => {
  it.each([
    [401, OPENAI_401, "auth"],
    [400, GEMINI_400, "auth"],
    [400, XAI_400, "auth"],
    [401, MISTRAL_401, "auth"],
    [403, {}, "auth"],
    [402, OPENROUTER_402, "billing"],
    [400, ANTHROPIC_LOW_BALANCE, "billing"],
    [429, OPENAI_QUOTA, "billing"],
    [429, GEMINI_429, "rate"],
    [429, {}, "rate"],
    [503, {}, "overloaded"],
    [529, {}, "overloaded"],
    [500, {}, "server"],
    [502, {}, "server"],
    [400, OPENAI_STRICT_SCHEMA, "rejected"],
    [404, {}, "rejected"],
    [408, {}, "rejected"],
    [422, { detail: [{ msg: "bad" }] }, "rejected"],
  ])("HTTP %i → %s", (status, body, kind) => {
    expect(classifyResponse(status, body).kind).toBe(kind);
  });

  it("carries the vendor's message as detail", () => {
    expect(classifyResponse(400, OPENAI_STRICT_SCHEMA).detail).toMatch(/Invalid schema/);
  });
});

describe("ProviderError", () => {
  const ctx: ErrorContext = {
    label: "OpenAI",
    host: "api.openai.com",
    model: "gpt-6-luna",
    custom: false,
    url: "https://api.openai.com/v1/chat/completions",
  };

  it("carries kind, status, detail and who was called", () => {
    const e = new ProviderError("auth", ctx, { status: 401, detail: "bad key" });
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe("ProviderError");
    expect([e.kind, e.status, e.detail, e.label, e.host, e.model, e.custom, e.url]).toEqual([
      "auth",
      401,
      "bad key",
      "OpenAI",
      "api.openai.com",
      "gpt-6-luna",
      false,
      ctx.url,
    ]);
  });

  it("defaults status to null and detail to empty", () => {
    const e = new ProviderError("network", ctx);
    expect(e.status).toBeNull();
    expect(e.detail).toBe("");
  });
});
