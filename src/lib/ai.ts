import { createOpenAI } from "@ai-sdk/openai";

const baseURL = process.env.AI_BASE_URL;
const apiKey = process.env.AI_API_KEY;

export const ai = createOpenAI({
  baseURL,
  apiKey,
});

export const MODELS = {
  primary: process.env.AI_MODEL_PRIMARY ?? "gpt-5.5",
  vision: process.env.AI_MODEL_VISION ?? "gpt-4o",
  cheap: process.env.AI_MODEL_CHEAP ?? "gpt-4o-mini",
} as const;

export function assertAiEnv() {
  if (!baseURL || !apiKey) {
    throw new Error(
      "AI_BASE_URL / AI_API_KEY missing — fill .env.local before calling AI",
    );
  }
}
