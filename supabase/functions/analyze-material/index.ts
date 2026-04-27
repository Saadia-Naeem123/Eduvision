// Analyze uploaded material (PDF / image) using multimodal AI.
// PDFs: extract text from up to 200 pages with unpdf, then summarize via Gemini.
// Images: send inline to multimodal Gemini.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { extractText, getDocumentProxy } from "https://esm.sh/unpdf@0.12.1";
import { corsHeaders, callAI, jsonResponse } from "../_shared/ai.ts";

const MAX_PAGES = 200;
const MAX_IMAGE_INLINE_BYTES = 12 * 1024 * 1024;
const MAX_TEXT_CHARS = 120_000; // ~30k tokens, safe for Gemini context

function bytesToBase64(buf: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) {
    binary += String.fromCharCode(...buf.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function extractPdfText(buf: Uint8Array): Promise<{ text: string; pages: number; truncated: boolean }> {
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const totalPages = pdf.numPages;
  const pagesToRead = Math.min(totalPages, MAX_PAGES);
  const { text } = await extractText(pdf, { mergePages: false });
  const arr = Array.isArray(text) ? text : [String(text)];
  const slice = arr.slice(0, pagesToRead);
  let combined = slice.map((t, i) => `--- Page ${i + 1} ---\n${t}`).join("\n\n");
  let truncated = totalPages > MAX_PAGES;
  if (combined.length > MAX_TEXT_CHARS) {
    combined = combined.slice(0, MAX_TEXT_CHARS) + "\n\n[...truncated for length...]";
    truncated = true;
  }
  return { text: combined, pages: totalPages, truncated };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { materialId } = await req.json();
    if (!materialId) return jsonResponse({ error: "materialId required" }, 400);

    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: mat, error: matErr } = await supabase.from("materials").select("*").eq("id", materialId).single();
    if (matErr || !mat) return jsonResponse({ error: "Material not found" }, 404);

    const { data: signed } = await supabase.storage.from("materials").createSignedUrl(mat.storage_path, 600);
    if (!signed?.signedUrl) return jsonResponse({ error: "Could not access file" }, 500);

    const fileRes = await fetch(signed.signedUrl);
    if (!fileRes.ok) return jsonResponse({ error: `Could not download file (${fileRes.status})` }, 500);
    const buf = new Uint8Array(await fileRes.arrayBuffer());
    const mime = mat.mime_type || (mat.storage_path.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/png");
    const isPdf = mime === "application/pdf" || mat.storage_path.toLowerCase().endsWith(".pdf");

    const sys = `You analyze a student's study material.
Return STRICT JSON: {"summary":"5-8 bullet markdown summary of the WHOLE document","topics":["..."],"key_terms":["..."],"diagrams_described":"plain-English description of any diagrams/tables, or empty"}`;

    let parsed: any;
    let extractedText = "";

    if (isPdf) {
      // Extract real text from up to 200 pages, then summarize.
      let pdfInfo: { text: string; pages: number; truncated: boolean };
      try {
        pdfInfo = await extractPdfText(buf);
      } catch (e) {
        console.error("pdf extract error", e);
        parsed = {
          summary: `• File "${mat.title}" uploaded.\n• Could not extract PDF text automatically (${e instanceof Error ? e.message : String(e)}).\n• You can still attach it in chat and ask questions page-by-page.`,
          topics: [], key_terms: [], diagrams_described: "",
        };
        await supabase.from("materials").update({
          ai_summary: parsed.summary, extracted_text: "", status: "analyzed",
        }).eq("id", materialId);
        return jsonResponse(parsed);
      }
      extractedText = pdfInfo.text;
      const noteIfTruncated = pdfInfo.truncated
        ? `\n(Note: document has ${pdfInfo.pages} pages; analysis covers first ${Math.min(pdfInfo.pages, MAX_PAGES)} pages.)`
        : "";

      const r = await callAI({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: sys },
          { role: "user", content: `Title: ${mat.title}\nPages analyzed: ${Math.min(pdfInfo.pages, MAX_PAGES)} of ${pdfInfo.pages}${noteIfTruncated}\n\nDOCUMENT TEXT:\n${pdfInfo.text}\n\nReturn the JSON now.` },
        ],
      });
      if (r.error) {
        parsed = {
          summary: `• File "${mat.title}" uploaded (${pdfInfo.pages} pages).\n• Automatic summary unavailable (${r.error}).\n• Text was extracted; you can ask the tutor about it in chat.`,
          topics: [], key_terms: [], diagrams_described: "",
        };
      } else {
        const raw = r.data.choices?.[0]?.message?.content ?? "";
        const m = raw.match(/\{[\s\S]*\}/);
        try {
          parsed = m ? JSON.parse(m[0]) : { summary: raw || "Analyzed.", topics: [], key_terms: [], diagrams_described: "" };
        } catch {
          parsed = { summary: raw || "Analyzed.", topics: [], key_terms: [], diagrams_described: "" };
        }
      }
    } else {
      // Image — multimodal inline
      if (buf.length > MAX_IMAGE_INLINE_BYTES) {
        parsed = {
          summary: `• Image "${mat.title}" uploaded (${Math.round(buf.length/1024/1024)} MB).\n• Too large for inline analysis. Attach in chat to ask specific questions.`,
          topics: [], key_terms: [], diagrams_described: "",
        };
      } else {
        const dataUrl = `data:${mime};base64,${bytesToBase64(buf)}`;
        const r = await callAI({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: sys },
            { role: "user", content: [
              { type: "text", text: `Title: ${mat.title}\nProvide the JSON summary.` },
              { type: "image_url", image_url: { url: dataUrl } },
            ] },
          ],
        });
        if (r.error) {
          parsed = {
            summary: `• Image "${mat.title}" uploaded.\n• Automatic analysis unavailable (${r.error}).\n• Attach in chat to ask the tutor about it.`,
            topics: [], key_terms: [], diagrams_described: "",
          };
        } else {
          const raw = r.data.choices?.[0]?.message?.content ?? "";
          const m = raw.match(/\{[\s\S]*\}/);
          try {
            parsed = m ? JSON.parse(m[0]) : { summary: raw || "Analyzed.", topics: [], key_terms: [], diagrams_described: "" };
          } catch {
            parsed = { summary: raw || "Analyzed.", topics: [], key_terms: [], diagrams_described: "" };
          }
        }
      }
    }

    await supabase.from("materials").update({
      ai_summary: parsed.summary,
      extracted_text: [extractedText, parsed.summary, parsed.diagrams_described, (parsed.key_terms ?? []).join(", ")]
        .filter(Boolean).join("\n\n").slice(0, 200_000),
      status: "analyzed",
    }).eq("id", materialId);

    return jsonResponse(parsed);
  } catch (e) {
    console.error("analyze-material error:", e);
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
