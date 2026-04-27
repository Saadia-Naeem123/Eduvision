// Shared CORS + AI gateway helpers
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

export function aiKey(): string {
  const k = Deno.env.get("LOVABLE_API_KEY");
  if (!k) throw new Error("LOVABLE_API_KEY not configured");
  return k;
}

export async function callAI(body: Record<string, unknown>) {
  const res = await fetch(AI_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${aiKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.status === 429) return { error: "Rate limit exceeded. Please wait a moment.", status: 429 };
  if (res.status === 402) return { error: "AI credits exhausted. Please add credits in workspace settings.", status: 402 };
  if (!res.ok) {
    const t = await res.text();
    return { error: `AI gateway error: ${res.status} ${t}`, status: res.status };
  }
  return { data: await res.json() as any, status: 200 };
}

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
