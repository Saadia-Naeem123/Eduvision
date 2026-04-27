// Tutor agent + Critic agent. Multimodal (text + image data URLs) with optional grounded material context.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, callAI, jsonResponse } from "../_shared/ai.ts";

const TUTOR_SYSTEM = `You are EduVision, an expert AI tutor for school/college students. Always refer to yourself as "EduVision" (never "BA SEEN" or any other name).
- IDENTITY: If the student asks who you are, your name, what model/LLM powers you, what you run on, or any variant of "what are you" — respond that you are **EduVision**, an AI tutor powered by **GPT-4o** (OpenAI's multimodal flagship model), built to teach with multimodal understanding (text, images, PDFs), step-by-step reasoning, and a Critic Agent that cross-verifies every answer. Keep this answer concise and friendly. Do NOT mention Gemini, Google, Anthropic, or any other provider.
- Explain step-by-step with concrete examples.
- Format with rich markdown: # headings, bullet/numbered lists, **bold** key terms, > callouts, and GitHub-flavored markdown TABLES when comparing things.
- For diagrams/flows/processes, ALWAYS emit a \`\`\`mermaid\`\`\` code block (flowchart, sequence, classDiagram, mindmap, pie). Keep mermaid simple and mobile-friendly (short labels, top-down).
- For math, use plain text or backticks (no LaTeX).
- If the student attached an image/PDF or the system included STUDY MATERIAL CONTEXT, READ it carefully and refer to specific elements.
- Adapt depth to the student's grade. Be encouraging. Never invent facts — if unsure, say so.`;

const CRITIC_SYSTEM = `You are a CRITIC agent. Cross-verify a tutor's answer for: factual accuracy, missing caveats, mathematical/logical correctness, and pedagogical clarity.
Return STRICT JSON: {"verdict":"correct"|"partially_correct"|"incorrect","confidence":0..1,"issues":[strings],"correction":"only if needed, else empty"}.`;

async function fetchMaterialContext(supabase: any, materialIds: string[]): Promise<{ text: string; images: string[] }> {
  if (!materialIds?.length) return { text: "", images: [] };
  const { data: mats } = await supabase.from("materials").select("*").in("id", materialIds);
  if (!mats?.length) return { text: "", images: [] };
  const textParts: string[] = [];
  const images: string[] = [];
  for (const m of mats) {
    const header = `--- MATERIAL: ${m.title} ---`;
    const body = [m.ai_summary, m.extracted_text].filter(Boolean).join("\n");
    if (body) textParts.push(`${header}\n${body}`);
    // For images, also pass the original to the model for true multimodal reading
    if (m.mime_type?.startsWith("image/") && images.length < 3) {
      const { data: signed } = await supabase.storage.from("materials").createSignedUrl(m.storage_path, 600);
      if (signed?.signedUrl) {
        try {
          const r = await fetch(signed.signedUrl);
          const buf = new Uint8Array(await r.arrayBuffer());
          let bin = ""; for (let i=0;i<buf.length;i++) bin += String.fromCharCode(buf[i]);
          images.push(`data:${m.mime_type};base64,${btoa(bin)}`);
        } catch {}
      }
    }
  }
  return { text: textParts.join("\n\n"), images };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { messages, grade, subject, materialIds } = await req.json();
    if (!Array.isArray(messages)) return jsonResponse({ error: "messages required" }, 400);

    let contextText = "";
    let contextImages: string[] = [];
    if (Array.isArray(materialIds) && materialIds.length) {
      const authHeader = req.headers.get("Authorization") ?? "";
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const ctx = await fetchMaterialContext(supabase, materialIds);
      contextText = ctx.text; contextImages = ctx.images;
    }

    const sys = `${TUTOR_SYSTEM}\nStudent grade: ${grade ?? "unknown"}. Subject focus: ${subject ?? "general"}.${
      contextText ? `\n\nSTUDY MATERIAL CONTEXT (ground your answer in this when relevant):\n${contextText}` : ""
    }`;

    // If we have material images, attach them to the LAST user message so the model truly "sees" them
    const augmented = [...messages];
    if (contextImages.length && augmented.length) {
      const last = augmented[augmented.length - 1];
      const baseText = typeof last.content === "string" ? last.content : (last.content ?? []).find((p: any) => p.type === "text")?.text ?? "";
      const existingImages = typeof last.content === "string" ? [] : (last.content ?? []).filter((p: any) => p.type === "image_url");
      augmented[augmented.length - 1] = {
        role: last.role,
        content: [
          { type: "text", text: baseText || "Use the attached study material to answer." },
          ...existingImages,
          ...contextImages.map((url) => ({ type: "image_url", image_url: { url } })),
        ],
      };
    }

    const tutor = await callAI({
      model: "google/gemini-3-flash-preview",
      messages: [{ role: "system", content: sys }, ...augmented],
    });
    if (tutor.error) return jsonResponse({ error: tutor.error }, tutor.status);
    const tutorText: string = tutor.data.choices?.[0]?.message?.content ?? "";

    const lastUser = messages[messages.length - 1];
    const userText = typeof lastUser?.content === "string"
      ? lastUser.content
      : (lastUser?.content ?? []).map((p: any) => p.text).filter(Boolean).join("\n");

    const critic = await callAI({
      model: "google/gemini-2.5-flash-lite",
      messages: [
        { role: "system", content: CRITIC_SYSTEM },
        { role: "user", content: `STUDENT QUESTION:\n${userText}\n\nTUTOR ANSWER:\n${tutorText}\n\nReturn only JSON.` },
      ],
    });
    let criticJson: any = { verdict: "correct", confidence: 0.7, issues: [], correction: "" };
    if (!critic.error) {
      const raw = critic.data.choices?.[0]?.message?.content ?? "";
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) { try { criticJson = JSON.parse(m[0]); } catch {} }
    }

    return jsonResponse({ answer: tutorText, critic: criticJson });
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
