import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/app/materials")({ component: MaterialsPage });

function MaterialsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("materials").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    setItems(data ?? []);
  };
  useEffect(() => { load(); }, [user?.id]);

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file || !user) return;
    if (file.size > 50 * 1024 * 1024) return toast.error("Max 50MB");
    setUploading(true);
    const path = `${user.id}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { error: upErr } = await supabase.storage.from("materials").upload(path, file);
    if (upErr) { setUploading(false); return toast.error(upErr.message); }
    const { data: m, error } = await supabase.from("materials").insert({
      user_id: user.id, title: file.name, storage_path: path, mime_type: file.type, size_bytes: file.size,
    }).select().single();
    setUploading(false);
    if (error) return toast.error(error.message);
    toast.success("Uploaded! Analyzing…");
    const { awardActivity } = await import("@/lib/progress");
    await awardActivity(user.id, 15);
    load();
    if (m) analyze(m.id);
  };

  const analyze = async (id: string) => {
    setAnalyzingId(id);
    const { data: { session } } = await supabase.auth.getSession();
    const { data, error } = await supabase.functions.invoke("analyze-material", {
      headers: { Authorization: `Bearer ${session?.access_token}` },
      body: { materialId: id },
    });
    setAnalyzingId(null);
    if (error || data?.error) return toast.error(error?.message || data.error);
    toast.success("AI analyzed your material");
    load();
  };

  const remove = async (m: any) => {
    if (!confirm("Delete this material?")) return;
    await supabase.storage.from("materials").remove([m.storage_path]);
    await supabase.from("materials").delete().eq("id", m.id);
    load();
  };

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold">Your materials</h1>
        <p className="text-sm text-muted-foreground mt-1">Upload your photos or PDFs.</p>
      </div>

      <label className={`block rounded-3xl border-2 border-dashed border-border/80 p-8 sm:p-12 text-center cursor-pointer hover:border-primary transition ${uploading && "opacity-60 pointer-events-none"}`}>
        <input type="file" accept="image/*,application/pdf" className="hidden" onChange={onUpload} disabled={uploading}/>
        {uploading ? <Loader2 className="size-6 mx-auto animate-spin text-primary"/> : <div className="text-3xl sm:text-4xl font-extrabold text-primary">+</div>}
        <div className="mt-3 font-extrabold text-base sm:text-lg">Upload photo or PDF</div>
        <div className="text-xs sm:text-sm text-muted-foreground mt-1 font-medium">Tap to choose a file (max 50MB)</div>
      </label>

      {items.length === 0 ? (
        <p className="text-sm text-center text-muted-foreground py-8">No materials yet upload one to start.</p>
      ) : (
        <ul className="grid sm:grid-cols-2 gap-3">
          {items.map((m) => (
            <li key={m.id} className="rounded-2xl bg-gradient-card border border-border/60 p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm sm:text-base truncate">{m.title}</div>
                  <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-2 font-semibold">
                    <Badge variant={m.status === "analyzed" ? "default" : "secondary"} className="text-[10px] font-bold">{m.status}</Badge>
                    {Math.round((m.size_bytes ?? 0)/1024)} KB
                  </div>
                </div>
              </div>
              {m.ai_summary && <p className="mt-3 text-xs sm:text-sm text-muted-foreground line-clamp-3 whitespace-pre-wrap">{m.ai_summary}</p>}
              <div className="mt-3 flex gap-2">
                {m.status !== "analyzed" && (
                  <Button size="sm" variant="outline" onClick={()=>analyze(m.id)} disabled={analyzingId===m.id} className="font-bold">
                    {analyzingId===m.id ? <Loader2 className="size-3 animate-spin mr-1"/> : null}Analyze
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={()=>remove(m)} className="font-bold text-destructive">Delete</Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
