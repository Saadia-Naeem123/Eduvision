// Adaptive quiz generator with scenario support
import { corsHeaders, callAI, jsonResponse } from "../_shared/ai.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { topic, grade, difficulty = "medium", count = 5, mode = "adaptive", materialText } = await req.json();
    if (!topic) return jsonResponse({ error: "topic required" }, 400);

    const scenarioHint = mode === "scenario"
      ? `Make every question a SHORT real-world SCENARIO (2-4 sentences) followed by a question.`
      : `Mix straightforward and applied questions.`;

    const sys = `You generate high-quality educational quizzes. Return STRICT JSON:
{"questions":[{"type":"mcq","question":"...","options":["A","B","C","D"],"correct":"A","explanation":"..."}]}.
Use exactly ${count} questions at "${difficulty}" difficulty for grade ${grade ?? "any"}.
${scenarioHint}
${materialText ? `Ground questions in this study material:\n${materialText.slice(0, 6000)}` : ""}`;

    const r = await callAI({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: sys },
        { role: "user", content: `Topic: ${topic}` },
      ],
    });
    if (r.error) return jsonResponse({ error: r.error }, r.status);
    const raw = r.data.choices?.[0]?.message?.content ?? "";
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return jsonResponse({ error: "Failed to parse quiz" }, 500);
    const parsed = JSON.parse(m[0]);
    return jsonResponse(parsed);
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
