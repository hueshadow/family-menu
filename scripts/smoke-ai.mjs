// Smoke test the AI endpoint with our system prompt; minimal token usage.
// Usage: npm run smoke:ai

const baseURL = process.env.AI_BASE_URL;
const apiKey = process.env.AI_API_KEY;
const model = process.env.AI_MODEL_PRIMARY || "gpt-5.5";

const res = await fetch(`${baseURL}/v1/chat/completions`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model,
    messages: [
      { role: "system", content: "你只输出 JSON，不要任何额外文字。" },
      {
        role: "user",
        content:
          "请输出 JSON 格式的回复：{\"ok\": true, \"sample\": \"清蒸鲈鱼\"}",
      },
    ],
  }),
});

const data = await res.json();
console.log("status:", res.status);
console.log("model:", data.model);
console.log("usage:", data.usage);
console.log("content:", data.choices?.[0]?.message?.content);
