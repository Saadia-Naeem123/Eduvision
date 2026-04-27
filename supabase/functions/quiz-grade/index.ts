// Critic agent for quiz answers (esp. open-ended). For MCQ, also adds explanation.
import { corsHeaders, callAI, jsonResponse } from "../_shared/ai.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { question, correctAnswer, userAnswer, type = "mcq" } = await req.json();
    if (!question) return jsonResponse({ error: "question required" }, 400);

    const sys = `You are a CRITIC AGENT grading a student's response. Be fair and pedagogical.
Return STRICT JSON: {"is_correct":bool,"score":0..1,"feedback":"short, encouraging feedback","explanation":"why the correct answer is correct"}.`;
    const userMsg = `Question: ${question}\nExpected/Correct: ${correctAnswer}\nStudent answered: ${userAnswer}\nType: ${type}`;

    const r = await callAI({
      model: "google/gemini-2.5-flash",
      messages: [{ role: "system", content: sys }, { role: "user", content: userMsg }],
    });
    if (r.error) return jsonResponse({ error: r.error }, r.status);
    const raw = r.data.choices?.[0]?.message?.content ?? "";
    const m = raw.match(/\{[\s\S]*\}/);
    const out = m ? JSON.parse(m[0]) : { is_correct: false, score: 0, feedback: "Could not grade", explanation: "" };
    return jsonResponse(out);
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
