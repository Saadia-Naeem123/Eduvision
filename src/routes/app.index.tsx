import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/app/")({ component: Dashboard });

const SUBJECTS = ["Mathematics","Physics","Chemistry","Biology","Computer Science","English"];

function Dashboard() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [recs, setRecs] = useState<any[]>([]);
  const [perf, setPerf] = useState<any[]>([]);
  const [quizCount, setQuizCount] = useState(0);
  const [recLoading, setRecLoading] = useState(false);

  // onboarding state
  const [grade, setGrade] = useState("10");
  const [subjects, setSubjects] = useState<string[]>([]);
  const [goal, setGoal] = useState("");

  const load = async () => {
    if (!user) return;
    const [{ data: p }, { data: r }, { data: pf }, { count: qc }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase.from("recommendations").select("*").eq("user_id", user.id).eq("dismissed", false).order("created_at", { ascending: false }),
      supabase.from("performance").select("*").eq("user_id", user.id),
      supabase.from("quiz_attempts").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    ]);
    setProfile(p); setRecs(r ?? []); setPerf(pf ?? []); setQuizCount(qc ?? 0);
    if (p?.grade) setGrade(p.grade);
    if (p?.subjects) setSubjects(p.subjects);
    if (p?.learning_goal) setGoal(p.learning_goal);
    return { p, r: r ?? [], pf: pf ?? [] };
  };

  const refreshRecs = async (silent = false) => {
    if (!silent) setRecLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const { error } = await supabase.functions.invoke("recommend", { headers: { Authorization: `Bearer ${session?.access_token}` } });
    if (!silent) setRecLoading(false);
    if (error && !silent) return toast.error(error.message);
    load();
  };

  useEffect(() => {
    (async () => {
      const res = await load();
      if (!res?.p?.onboarded) return;
      // Daily streak ping (no XP) — keeps streak rolling on each visit
      const { awardActivity } = await import("@/lib/progress");
      await awardActivity(user!.id, 0);
      await load();
      // Auto-refresh recommendations if a quiz attempt happened more recently than the latest recommendation
      const { data: lastAttempt } = await supabase
        .from("quiz_attempts")
        .select("created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const lastRecAt = res.r[0]?.created_at;
      const stale = lastAttempt && (!lastRecAt || new Date(lastAttempt.created_at) > new Date(lastRecAt));
      const empty = res.r.length === 0 && (res.pf.length > 0 || (res.p.subjects?.length ?? 0) > 0);
      if (stale || empty) refreshRecs(true);
    })();
  }, [user?.id]);

  const saveProfile = async () => {
    if (!user) return;
    if (!subjects.length) return toast.error("Pick at least one subject.");
    const { error } = await supabase.from("profiles").update({ grade, subjects, learning_goal: goal, onboarded: true }).eq("id", user.id);
    if (error) return toast.error(error.message);
    toast.success("Profile saved!");
    await load();
    refreshRecs();
  };

  if (!profile) return <div className="text-muted-foreground">Loading…</div>;

  const onboard = !profile.onboarded;
  const masteryAvg = perf.length ? Math.round(perf.reduce((a,p)=>a+Number(p.mastery),0) / perf.length * 100) : 0;

  return (
    <div className="space-y-5 sm:space-y-6">
      {onboard ? (
        <section className="rounded-3xl bg-gradient-card border border-border/60 p-5 sm:p-7 shadow-elevated max-w-2xl mx-auto">
          <div className="text-xs font-bold tracking-widest uppercase text-primary">Welcome</div>
          <h2 className="mt-2 text-2xl sm:text-3xl font-extrabold">Let's personalize your mentor</h2>
          <p className="text-sm text-muted-foreground mt-1">Tell us a bit about your studies.</p>
          <div className="mt-4 space-y-3">
            <div><Label className="font-bold">Grade</Label>
              <select value={grade} onChange={(e)=>setGrade(e.target.value)} className="mt-1 w-full rounded-md bg-input border border-border px-3 py-2 text-sm">
                {["9","10","11","12"].map((g)=> <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <Label className="font-bold">Subjects</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {SUBJECTS.map((s)=>{
                  const on = subjects.includes(s);
                  return <button key={s} type="button" onClick={()=> setSubjects(on ? subjects.filter(x=>x!==s) : [...subjects, s])}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition ${on ? "bg-gradient-primary text-primary-foreground border-transparent shadow-glow" : "bg-secondary text-secondary-foreground border-border"}`}>{s}</button>;
                })}
              </div>
            </div>
            <div><Label className="font-bold">Goal (optional)</Label><Input value={goal} onChange={(e)=>setGoal(e.target.value)} placeholder="e.g. Ace my finals"/></div>
            <Button className="w-full bg-gradient-primary text-primary-foreground shadow-glow font-bold" onClick={saveProfile}>Save & continue</Button>
          </div>
        </section>
      ) : (
        <>
          <section className="rounded-3xl bg-gradient-card border border-border/60 p-5 sm:p-7 shadow-elevated">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div className="text-xs font-semibold text-muted-foreground">Hello,</div>
                <h2 className="text-2xl sm:text-4xl font-extrabold">{profile.full_name?.split(" ")[0] ?? "Student"}</h2>
                <p className="text-sm text-muted-foreground mt-1 font-medium">Grade {profile.grade} • {profile.subjects?.join(", ")}</p>
              </div>
              <div className="flex gap-4 sm:gap-6">
                <div className="text-right">
                  <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Streak</div>
                  <div className="text-warning text-xl sm:text-2xl font-extrabold">{profile.streak_days}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">XP</div>
                  <div className="text-primary text-xl sm:text-2xl font-extrabold">{profile.total_xp}</div>
                </div>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
              <Stat label="Avg mastery" value={`${masteryAvg}%`}/>
              <Stat label="Topics" value={`${perf.length}`}/>
              <Stat label="Quizzes" value={`${quizCount}`}/>
            </div>
          </section>

          <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <ActionCard to="/app/chat" label="Ask the Tutor" desc="Step-by-step explanations"/>
            <ActionCard to="/app/quiz" label="Adaptive Quiz" desc="Difficulty adapts to you"/>
            <ActionCard to="/app/topics" label="Explore Topics" desc="Browse the syllabus"/>
            <ActionCard to="/app/materials" label="Upload Notes" desc="PDF, photo, diagram"/>
          </section>

          <section className="rounded-3xl bg-gradient-card border border-border/60 p-5 sm:p-7">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-extrabold text-lg">Recommended for you</h3>
              <Button size="sm" variant="ghost" onClick={()=>refreshRecs()} disabled={recLoading} className="font-bold">
                {recLoading ? "Refreshing…" : "Refresh"}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Updated automatically as the system learns from your quizzes & chats.</p>
            {recs.length === 0 ? (
              <p className="text-sm text-muted-foreground mt-3">Take a quiz or chat with the tutor — your recommendations will appear here.</p>
            ) : (
              <ul className="mt-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {recs.slice(0,6).map((r)=> (
                  <li key={r.id} className="rounded-2xl bg-background/40 border border-border/50 p-4">
                    <Badge variant="outline" className="text-[10px] font-bold uppercase">{r.kind}</Badge>
                    <div className="text-sm font-bold mt-2">{r.title}</div>
                    <div className="text-xs text-muted-foreground mt-1">{r.reason}</div>
                    <Link to="/app/quiz" className="text-primary text-xs font-bold mt-3 inline-block">Start →</Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl bg-background/40 border border-border/50 p-3 text-center">
    <div className="text-xl sm:text-2xl font-extrabold">{value}</div>
    <div className="text-[10px] sm:text-xs uppercase tracking-wider font-bold text-muted-foreground mt-0.5">{label}</div>
  </div>;
}

function ActionCard({ to, label, desc }: any) {
  return (
    <Link to={to} className="rounded-2xl bg-gradient-card border border-border/60 p-4 sm:p-5 hover:shadow-glow hover:border-primary/40 transition">
      <div className="font-extrabold text-base">{label}</div>
      <div className="text-xs sm:text-sm text-muted-foreground mt-1">{desc}</div>
    </Link>
  );
}
