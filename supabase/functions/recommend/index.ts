// Recommendation agent — uses performance + profile + recent activity to suggest next study actions
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, callAI, jsonResponse } from "../_shared/ai.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return jsonResponse({ error: "Unauthorized" }, 401);

    const [
      { data: profile },
      { data: perf },
      { data: recentAttempts },
      { data: recentAnswers },
      { data: catalogue },
    ] = await Promise.all([
      supabase.from("profiles").select("grade,subjects,learning_goal").eq("id", user.id).single(),
      supabase.from("performance").select("subject,topic,mastery,attempts,correct,updated_at").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(40),
      supabase.from("quiz_attempts").select("topic_title,difficulty,score,total,mode,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(10),
      supabase.from("quiz_answers").select("question,is_correct,difficulty,critic_feedback,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
      supabase.from("topics").select("title,subject,grade,difficulty,summary").limit(50),
    ]);

    // Surface weakest areas & recent struggle points
    const weakest = (perf ?? []).slice().sort((a:any,b:any) => Number(a.mastery) - Number(b.mastery)).slice(0, 5);
    const strongest = (perf ?? []).slice().sort((a:any,b:any) => Number(b.mastery) - Number(a.mastery)).slice(0, 3);
    const recentMisses = (recentAnswers ?? []).filter((a:any) => a.is_correct === false).slice(0, 8);

    const sys = `You are an adaptive study coach for an AI tutoring app. Based on the student's profile, performance, and recent learning activity, generate 4-6 highly personalized recommendations for what to study next.

Rules:
- Mix recommendation kinds: "review" (low-mastery topics), "practice" (recent struggles), "new_topic" (logical next step matching their grade & subjects), "scenario" (real-world application).
- Each recommendation must reference a specific topic the student has touched OR a clearly related new one.
- The "reason" must be concrete and reference actual data (e.g. "You scored 2/5 on this last attempt" or "Mastery is 22% — reinforce fundamentals").
- Adapt to the student's grade level; do not propose topics far above or below their grade.
- Avoid duplicating recent recommendations.

Return STRICT JSON:
{"recommendations":[{"kind":"practice"|"review"|"new_topic"|"scenario","title":"...","reason":"...","subject":"...","topic":"..."}]}`;

    const ctx = `Profile: ${JSON.stringify(profile)}
Weakest topics (act on these first): ${JSON.stringify(weakest)}
Strongest topics (avoid recommending — extend instead): ${JSON.stringify(strongest)}
Recent quiz attempts: ${JSON.stringify(recentAttempts ?? [])}
Recent incorrect answers: ${JSON.stringify(recentMisses)}
Curriculum catalogue (pick from these when proposing new_topic): ${JSON.stringify(catalogue ?? [])}`;

    const r = await callAI({
      model: "google/gemini-2.5-flash",
      messages: [{ role: "system", content: sys }, { role: "user", content: ctx }],
    });
    if (r.error) return jsonResponse({ error: r.error }, r.status);
    const raw = r.data.choices?.[0]?.message?.content ?? "";
    const m = raw.match(/\{[\s\S]*\}/);
    const parsed = m ? JSON.parse(m[0]) : { recommendations: [] };

    // Persist (replace previous undismissed)
    await supabase.from("recommendations").update({ dismissed: true }).eq("user_id", user.id).eq("dismissed", false);
    if (parsed.recommendations?.length) {
      await supabase.from("recommendations").insert(parsed.recommendations.map((r: any) => ({
        user_id: user.id, kind: r.kind ?? "practice", title: r.title, reason: r.reason, payload: { subject: r.subject, topic: r.topic },
      })));
    }
    return jsonResponse(parsed);
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
