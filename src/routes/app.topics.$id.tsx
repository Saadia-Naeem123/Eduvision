import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { RichMarkdown } from "@/components/RichMarkdown";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export const Route = createFileRoute("/app/topics/$id")({ component: TopicDetail });

function TopicDetail() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const [topic, setTopic] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [explanation, setExplanation] = useState("");
  const [critic, setCritic] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [materials, setMaterials] = useState<any[]>([]);
  const [attached, setAttached] = useState<any[]>([]);
  const autoFetchedRef = useRef(false);

  useEffect(() => { supabase.from("topics").select("*").eq("id", id).single().then(({ data }) => setTopic(data)); }, [id]);
  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("grade,subjects").eq("id", user.id).single().then(({data})=>setProfile(data ?? {}));
    supabase.from("materials").select("id,title,status,mime_type").eq("user_id", user.id).order("created_at",{ascending:false}).limit(20).then(({data})=>setMaterials(data ?? []));
  }, [user?.id]);

  const toggle = (m: any) => setAttached(p => p.find(x=>x.id===m.id) ? p.filter(x=>x.id!==m.id) : [...p, m]);

  const explain = async (extraMaterials: any[] = attached) => {
    if (!topic) return;
    setLoading(true); setExplanation(""); setCritic(null);
    const grounding = extraMaterials.length ? ` Use my attached study material to ground the explanation.` : "";
    const userGrade = profile?.grade ?? topic.grade;
    const { data: { session } } = await supabase.auth.getSession();
    const { data, error } = await supabase.functions.invoke("tutor-chat", {
      headers: { Authorization: `Bearer ${session?.access_token}` },
      body: {
        messages: [{ role: "user", content: `Explain "${topic.title}" (${topic.subject}, Grade ${userGrade}) clearly with curriculum-aligned definitions, worked examples, a comparison table when useful, and a mermaid diagram when it helps. Tailor the depth to the student's grade level.${grounding}` }],
        grade: userGrade,
        subject: topic.subject,
        materialIds: extraMaterials.map(m=>m.id),
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    if (data?.error) return toast.error(data.error);
    if (!data?.answer) return toast.error("No explanation returned. Please try again.");
    setExplanation(data.answer); setCritic(data.critic);

    // Track interaction so recommendations adapt + award XP/streak
    if (user && topic) {
      const subject = topic.subject ?? "General";
      const { data: existing } = await supabase
        .from("performance")
        .select("*")
        .eq("user_id", user.id)
        .eq("subject", subject)
        .eq("topic", topic.title)
        .maybeSingle();
      if (!existing) {
        await supabase.from("performance").insert({
          user_id: user.id, subject, topic: topic.title,
          mastery: 0.05, attempts: 0, correct: 0,
        });
      }
      const { awardActivity } = await import("@/lib/progress");
      await awardActivity(user.id, 5);
    }
  };

  // Auto-load tutor explanation when topic loads (one-shot per topic).
  // Run as soon as topic is loaded — don't block on profile, since topic.grade is a safe fallback.
  useEffect(() => {
    if (topic && !autoFetchedRef.current) {
      autoFetchedRef.current = true;
      explain([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topic?.id]);

  if (!topic) return <div className="text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <Link to="/app/topics" className="inline-flex items-center text-sm font-bold text-muted-foreground hover:text-foreground">← All topics</Link>
      <header className="rounded-3xl bg-gradient-card border border-border/60 p-5 sm:p-7">
        <div className="text-xs text-primary font-extrabold tracking-widest uppercase">{topic.subject}</div>
        <h1 className="text-2xl sm:text-4xl font-extrabold mt-1">{topic.title}</h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-2">{topic.summary}</p>
        <div className="mt-3 flex gap-2 flex-wrap">
          <Badge variant="outline" className="text-[10px] font-bold">Grade {topic.grade}</Badge>
          <Badge variant="outline" className="text-[10px] font-bold">{topic.difficulty}</Badge>
        </div>

        {attached.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {attached.map((m) => (
              <span key={m.id} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-primary/15 border border-primary/30 text-[11px] font-semibold">
                <span className="max-w-[140px] truncate">{m.title}</span>
                <button onClick={()=>toggle(m)} className="hover:text-destructive font-bold">×</button>
              </span>
            ))}
          </div>
        )}

        <div className="mt-4 flex gap-2 flex-wrap">
          <Button onClick={()=>explain()} disabled={loading} className="bg-gradient-primary text-primary-foreground shadow-glow font-bold">
            {loading ? <Loader2 className="size-4 animate-spin mr-2"/> : null}{explanation ? "Re-explain" : "Explain"}
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="font-bold">Attach material{attached.length > 0 && ` (${attached.length})`}</Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-72 p-2 bg-card border-border/60 max-h-72 overflow-y-auto">
              <div className="text-xs font-bold mb-2 px-1 text-muted-foreground uppercase tracking-wider">Ground explanation in</div>
              {materials.length === 0 ? (
                <p className="text-xs text-muted-foreground p-2">No materials yet — upload in the Notes tab.</p>
              ) : materials.map((m) => {
                const on = !!attached.find(x=>x.id===m.id);
                return (
                  <button key={m.id} onClick={()=>toggle(m)} className={`w-full text-left flex items-center gap-2 p-2 rounded-lg text-xs font-medium hover:bg-primary/10 ${on ? "bg-primary/15" : ""}`}>
                    <span className="truncate flex-1">{m.title}</span>
                    {on && <span className="text-primary text-[10px] font-bold">✓</span>}
                  </button>
                );
              })}
            </PopoverContent>
          </Popover>
          <Link to="/app/quiz" search={{ topic: topic.title } as any}>
            <Button variant="outline" className="font-bold">Quiz me</Button>
          </Link>
        </div>
      </header>

      {loading && !explanation && (
        <article className="rounded-3xl bg-gradient-card border border-border/60 p-5 sm:p-7">
          <div className="flex items-center gap-2 text-muted-foreground text-sm font-semibold">
            <Loader2 className="size-4 animate-spin"/>The tutor is preparing your explanation…
          </div>
        </article>
      )}

      {explanation && (
        <article className="rounded-3xl bg-gradient-card border border-border/60 p-5 sm:p-7">
          <h2 className="font-extrabold text-lg mb-3">Tutor explanation</h2>
          <RichMarkdown content={explanation} />
          {critic && (
            <div className="mt-4 rounded-2xl bg-background/40 border border-border/50 p-3">
              <div className="flex items-center gap-2 text-xs flex-wrap">
                <span className="font-extrabold uppercase tracking-wider">Critic Agent:</span>
                <Badge variant={critic.verdict === "correct" ? "default" : "secondary"} className="text-[10px] font-bold">{critic.verdict}</Badge>
                <span className="text-muted-foreground font-semibold">confidence {Math.round((critic.confidence ?? 0)*100)}%</span>
              </div>
              {critic.issues?.length > 0 && <ul className="mt-2 text-xs text-muted-foreground list-disc pl-4">{critic.issues.map((i: string, idx: number) => <li key={idx}>{i}</li>)}</ul>}
              {critic.correction && <p className="mt-2 text-xs"><span className="font-bold">Correction:</span> {critic.correction}</p>}
            </div>
          )}
        </article>
      )}
    </div>
  );
}
