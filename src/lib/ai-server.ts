import "server-only";

const baseURL = process.env.AI_BASE_URL;
const apiKey = process.env.AI_API_KEY;

export const MODELS = {
  primary: process.env.AI_MODEL_PRIMARY ?? "gpt-5.5",
  vision: process.env.AI_MODEL_VISION ?? "gpt-4o",
  cheap: process.env.AI_MODEL_CHEAP ?? "gpt-4o-mini",
} as const;

export async function chatJson<T>(opts: {
  model: string;
  system: string;
  user: string;
  responseFormat?: "json_object" | "text";
  signal?: AbortSignal;
}): Promise<T> {
  if (!baseURL || !apiKey) throw new Error("AI_BASE_URL / AI_API_KEY missing");

  const body: Record<string, unknown> = {
    model: opts.model,
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: opts.user },
    ],
  };
  if (opts.responseFormat === "json_object") {
    body.response_format = { type: "json_object" };
  }

  const res = await fetch(`${baseURL}/v1/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: opts.signal,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AI ${res.status}: ${text.slice(0, 500)}`);
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error("AI response missing message.content");
  }
  return parseJsonLoose(content) as T;
}

export function parseJsonLoose(text: string): unknown {
  const stripped = text.trim();
  try {
    return JSON.parse(stripped);
  } catch {
    /* fallthrough */
  }
  const fence = stripped.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) {
    try {
      return JSON.parse(fence[1].trim());
    } catch {
      /* fallthrough */
    }
  }
  const first = stripped.indexOf("{");
  const last = stripped.lastIndexOf("}");
  if (first >= 0 && last > first) {
    try {
      return JSON.parse(stripped.slice(first, last + 1));
    } catch {
      /* fallthrough */
    }
  }
  throw new Error(`AI returned non-JSON: ${stripped.slice(0, 200)}`);
}
