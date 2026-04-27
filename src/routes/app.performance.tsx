import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/app/performance")({ component: PerfPage });

function PerfPage() {
  const { user } = useAuth();
  const [perf, setPerf] = useState<any[]>([]);
  const [attempts, setAttempts] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase.from("performance").select("*").eq("user_id", user.id).order("mastery", { ascending: false }).then(({data})=>setPerf(data ?? []));
    supabase.from("quiz_attempts").select("*").eq("user_id", user.id).order("created_at",{ascending:false}).limit(10).then(({data})=>setAttempts(data ?? []));
  }, [user?.id]);

  const avg = perf.length ? Math.round(perf.reduce((a,p)=>a+Number(p.mastery),0) / perf.length * 100) : 0;
  const totalQ = perf.reduce((a,p)=>a+p.attempts,0);
  const totalC = perf.reduce((a,p)=>a+p.correct,0);

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold">Performance</h1>
        <p className="text-sm text-muted-foreground mt-1">Your mastery curve and recent quiz history.</p>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Stat label="Avg mastery" value={`${avg}%`}/>
        <Stat label="Accuracy" value={totalQ ? `${Math.round(totalC/totalQ*100)}%` : "—"}/>
        <Stat label="Topics" value={`${perf.length}`}/>
      </div>

      <section>
        <h2 className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground mb-2 px-1">Mastery by topic</h2>
        {perf.length === 0 ? <p className="text-sm text-muted-foreground text-center py-6">Take a quiz to start tracking.</p> : (
          <ul className="grid sm:grid-cols-2 gap-2 sm:gap-3">
            {perf.map((p) => (
              <li key={p.id} className="rounded-2xl bg-gradient-card border border-border/60 p-3 sm:p-4">
                <div className="flex items-center justify-between text-sm">
                  <div>
                    <div className="font-bold">{p.topic}</div>
                    <div className="text-[11px] text-muted-foreground font-semibold">{p.subject} • {p.correct}/{p.attempts} correct</div>
                  </div>
                  <span className="text-sm font-extrabold text-primary">{Math.round(Number(p.mastery)*100)}%</span>
                </div>
                <Progress value={Number(p.mastery)*100} className="mt-2 h-1.5"/>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground mb-2 px-1">Recent quizzes</h2>
        <ul className="grid sm:grid-cols-2 gap-2 sm:gap-3">
          {attempts.map((a) => (
            <li key={a.id} className="flex items-center justify-between rounded-2xl bg-gradient-card border border-border/60 p-3 sm:p-4 text-sm">
              <div>
                <div className="font-bold">{a.topic_title}</div>
                <div className="text-[11px] text-muted-foreground font-semibold">{new Date(a.created_at).toLocaleDateString()} • {a.mode}</div>
              </div>
              <Badge variant={a.score / Math.max(a.total,1) >= 0.7 ? "default" : "secondary"} className="text-[10px] font-bold">{a.score}/{a.total}</Badge>
            </li>
          ))}
          {attempts.length === 0 && <p className="text-sm text-muted-foreground text-center py-3">No attempts yet.</p>}
        </ul>
      </section>
    </div>
  );
}

function Stat({ label, value }: any) {
  return <div className="rounded-2xl bg-gradient-card border border-border/60 p-3 sm:p-4 text-center">
    <div className="text-xl sm:text-2xl font-extrabold">{value}</div>
    <div className="text-[10px] sm:text-xs uppercase tracking-wider font-bold text-muted-foreground mt-0.5">{label}</div>
  </div>;
}
