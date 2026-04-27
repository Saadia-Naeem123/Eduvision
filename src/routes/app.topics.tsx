import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/app/topics")({ component: TopicsPage });

function TopicsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [topics, setTopics] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [q, setQ] = useState("");
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    supabase.from("topics").select("*").order("subject").then(({ data }) => setTopics(data ?? []));
    if (user) supabase.from("profiles").select("grade,subjects").eq("id", user.id).single().then(({ data }) => setProfile(data));
  }, [user?.id]);

  const userGrade = profile?.grade ?? null;
  const gradeFiltered = showAll || !userGrade ? topics : topics.filter((t) => String(t.grade) === String(userGrade));
  const filtered = gradeFiltered.filter((t) => `${t.title} ${t.subject} ${t.tags?.join(" ")}`.toLowerCase().includes(q.toLowerCase()));
  const grouped = filtered.reduce<Record<string, any[]>>((acc, t) => { (acc[t.subject] ||= []).push(t); return acc; }, {});

  const teachInChat = (t: any) => {
    const prompt = `Please teach me the topic "${t.title}" from ${t.subject} (Grade ${t.grade}).

Context from my curriculum:
${t.summary ?? ""}
${t.tags?.length ? `Key concepts: ${t.tags.join(", ")}.` : ""}

Walk me through it step-by-step like a tutor: start with an intuitive overview, then key definitions, a worked example, a comparison table when useful, and a mermaid diagram if it helps. Tailor the depth to Grade ${t.grade}. End with 2 quick check-your-understanding questions.`;
    sessionStorage.setItem("eduvision:tutor:prefill", prompt);
    sessionStorage.setItem("eduvision:tutor:autosend", "1");
    navigate({ to: "/app/chat" });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold">Topics{userGrade ? ` · Grade ${userGrade}` : ""}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {userGrade && !showAll
              ? "Curriculum topics for your grade. Tap one to have the tutor teach it in chat."
              : "Tap any topic to have the tutor teach it in chat."}
          </p>
        </div>
        <div className="flex gap-2 items-center">
          {userGrade && (
            <button
              onClick={() => setShowAll((s) => !s)}
              className="text-xs font-bold px-3 py-1.5 rounded-full border border-border bg-secondary text-secondary-foreground hover:bg-primary/10"
            >
              {showAll ? `Only Grade ${userGrade}` : "Show all grades"}
            </button>
          )}
          <Input placeholder="Search topics…" value={q} onChange={(e)=>setQ(e.target.value)} className="max-w-xs font-medium"/>
        </div>
      </div>

      {Object.entries(grouped).map(([subject, list]) => (
        <section key={subject} className="space-y-3">
          <h2 className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground px-1">{subject}</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {list.map((t) => (
              <button
                key={t.id}
                onClick={() => teachInChat(t)}
                className="text-left block rounded-2xl bg-gradient-card border border-border/60 p-4 sm:p-5 hover:shadow-glow hover:border-primary/40 transition"
              >
                <div className="text-[10px] font-bold uppercase tracking-widest text-primary">{t.subject}</div>
                <div className="font-extrabold text-base mt-1">{t.title}</div>
                <div className="text-xs sm:text-sm text-muted-foreground mt-1.5 line-clamp-3">{t.summary}</div>
                <div className="mt-3 flex gap-1.5 flex-wrap">
                  <Badge variant="outline" className="text-[10px] font-bold">Grade {t.grade}</Badge>
                  <Badge variant="outline" className="text-[10px] font-bold">{t.difficulty}</Badge>
                  {t.tags?.slice(0,2).map((tag: string) => <Badge key={tag} variant="secondary" className="text-[10px] font-semibold">{tag}</Badge>)}
                </div>
                <div className="mt-3 text-[11px] font-bold text-primary">Teach me this →</div>
              </button>
            ))}
          </div>
        </section>
      ))}
      {filtered.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">
          {userGrade && !showAll
            ? `No topics for Grade ${userGrade} yet — tap "Show all grades" to browse the catalogue.`
            : "No topics found."}
        </p>
      )}
    </div>
  );
}
