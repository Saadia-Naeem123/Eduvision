import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/app/quiz")({ component: QuizPage });

type Q = { type: string; question: string; options: string[]; correct: string; explanation: string };

const DIFF: Record<string, string> = { easy: "easy", medium: "medium", hard: "hard" };

function QuizPage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [topic, setTopic] = useState("");
  const [mode, setMode] = useState<"adaptive" | "scenario">("adaptive");
  const [difficulty, setDifficulty] = useState("medium");
  const [questions, setQuestions] = useState<Q[]>([]);
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [grade, setGrade] = useState<{ ok: boolean; feedback: string; explanation: string } | null>(null);
  const [score, setScore] = useState(0);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [materialId, setMaterialId] = useState<string>("");
  const [materials, setMaterials] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("grade,subjects").eq("id", user.id).single().then(({data})=>setProfile(data));
    supabase.from("materials").select("id,title").eq("user_id", user.id).order("created_at",{ascending:false}).then(({data})=>setMaterials(data ?? []));
  }, [user?.id]);

  const start = async () => {
    if (!topic.trim()) return toast.error("Pick a topic");
    setLoading(true); setQuestions([]); setIdx(0); setScore(0); setDone(false); setPicked(null); setRevealed(false); setGrade(null);

    let materialText: string | null = null;
    if (materialId) {
      const { data } = await supabase.from("materials").select("extracted_text,ai_summary").eq("id", materialId).single();
      materialText = [data?.ai_summary, data?.extracted_text].filter(Boolean).join("\n");
    }

    const { data: { session } } = await supabase.auth.getSession();
    const { data, error } = await supabase.functions.invoke("quiz-generate", {
      headers: { Authorization: `Bearer ${session?.access_token}` },
      body: { topic, grade: profile?.grade, difficulty, count: 5, mode, materialText },
    });
    setLoading(false);
    if (error || data?.error) return toast.error(error?.message || data.error);

    setQuestions(data.questions ?? []);
    const { data: att } = await supabase.from("quiz_attempts").insert({
      user_id: user!.id, topic_title: topic, mode, difficulty, total: data.questions?.length ?? 0,
    }).select().single();
    setAttemptId(att?.id ?? null);
  };

  const submit = async () => {
    if (!picked || !questions[idx] || !attemptId) return;
    const q = questions[idx];
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const { data: g } = await supabase.functions.invoke("quiz-grade", {
      headers: { Authorization: `Bearer ${session?.access_token}` },
      body: { question: q.question, correctAnswer: q.correct, userAnswer: picked, type: q.type },
    });
    setLoading(false);
    const ok = !!g?.is_correct;
    setGrade({ ok, feedback: g?.feedback ?? "", explanation: g?.explanation ?? q.explanation });
    setRevealed(true);
    if (ok) setScore(s => s+1);

    await supabase.from("quiz_answers").insert({
      attempt_id: attemptId, user_id: user!.id, question: q.question, question_type: q.type,
      options: q.options, correct_answer: q.correct, user_answer: picked, is_correct: ok,
      difficulty, critic_feedback: g?.feedback, explanation: g?.explanation ?? q.explanation,
    });

    if (mode === "adaptive") {
      if (ok && difficulty !== "hard") setDifficulty(difficulty === "easy" ? "medium" : "hard");
      else if (!ok && difficulty !== "easy") setDifficulty(difficulty === "hard" ? "medium" : "easy");
    }

    const { data: existing } = await supabase.from("performance").select("*").eq("user_id", user!.id).eq("subject", profile?.subjects?.[0] ?? "General").eq("topic", topic).maybeSingle();
    const prev = Number(existing?.mastery ?? 0);
    const newM = prev * 0.7 + (ok ? 1 : 0) * 0.3;
    await supabase.from("performance").upsert({
      user_id: user!.id, subject: profile?.subjects?.[0] ?? "General", topic,
      mastery: newM, attempts: (existing?.attempts ?? 0) + 1, correct: (existing?.correct ?? 0) + (ok ? 1 : 0),
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,subject,topic" });
  };

  const next = async () => {
    setPicked(null); setRevealed(false); setGrade(null);
    if (idx + 1 >= questions.length) {
      setDone(true);
      if (attemptId) await supabase.from("quiz_attempts").update({ score, completed: true }).eq("id", attemptId);
      // 10 XP per correct + 5 XP completion bonus, also bumps streak
      const { awardActivity } = await import("@/lib/progress");
      await awardActivity(user!.id, score * 10 + 5);
      // Refresh recommendations now that the system has new performance data
      const { data: { session } } = await supabase.auth.getSession();
      supabase.functions.invoke("recommend", { headers: { Authorization: `Bearer ${session?.access_token}` } });
    } else {
      setIdx(idx + 1);
    }
  };

  if (!questions.length && !done) {
    return (
      <div className="space-y-4 max-w-2xl mx-auto">
        <div className="rounded-3xl bg-gradient-card border border-border/60 p-5 sm:p-7">
          <div className="text-xs font-extrabold uppercase tracking-widest text-primary">Quiz setup</div>
          <h1 className="text-2xl sm:text-3xl font-extrabold mt-2">Adaptive Quiz</h1>
          <div className="mt-4 space-y-3">
            <div><Label className="font-bold">Topic</Label><Input value={topic} onChange={(e)=>setTopic(e.target.value)} placeholder="e.g. Photosynthesis"/></div>
            <div>
              <Label className="font-bold">Mode</Label>
              <div className="flex gap-2 mt-1 flex-wrap">
                <ModeBtn active={mode==="adaptive"} onClick={()=>setMode("adaptive")}>Adaptive</ModeBtn>
                <ModeBtn active={mode==="scenario"} onClick={()=>setMode("scenario")}>Scenario-based</ModeBtn>
              </div>
            </div>
            <div>
              <Label className="font-bold">Starting difficulty</Label>
              <div className="flex gap-2 mt-1 flex-wrap">
                {Object.keys(DIFF).map(d => <ModeBtn key={d} active={difficulty===d} onClick={()=>setDifficulty(d)}>{d}</ModeBtn>)}
              </div>
            </div>
            {materials.length > 0 && (
              <div>
                <Label className="font-bold">Ground in your material (optional)</Label>
                <select value={materialId} onChange={(e)=>setMaterialId(e.target.value)} className="mt-1 w-full rounded-md bg-input border border-border px-3 py-2 text-sm">
                  <option value="">— None —</option>
                  {materials.map(m=> <option key={m.id} value={m.id}>{m.title}</option>)}
                </select>
              </div>
            )}
            <Button onClick={start} disabled={loading} className="w-full bg-gradient-primary text-primary-foreground shadow-glow font-bold">
              {loading ? <Loader2 className="size-4 animate-spin"/> : "Start quiz"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (done) {
    const pct = Math.round((score / questions.length) * 100);
    return (
      <div className="rounded-3xl bg-gradient-card border border-border/60 p-6 sm:p-10 text-center max-w-xl mx-auto">
        <div className="text-6xl">{pct >= 80 ? "🎉" : pct >= 50 ? "💪" : "📚"}</div>
        <h2 className="text-3xl sm:text-4xl font-extrabold mt-3">{score} / {questions.length}</h2>
        <p className="text-muted-foreground mt-1 font-semibold">+{score * 10} XP earned</p>
        <Progress value={pct} className="mt-4"/>
        <Button className="mt-5 bg-gradient-primary text-primary-foreground shadow-glow font-bold" onClick={()=>{ setQuestions([]); setDone(false); }}>New quiz</Button>
      </div>
    );
  }

  const q = questions[idx];
  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between text-xs font-bold text-muted-foreground">
        <span>Question {idx+1} / {questions.length}</span>
        <Badge variant="outline" className="text-[10px] font-bold">{difficulty}</Badge>
      </div>
      <Progress value={((idx) / questions.length) * 100}/>
      <div className="rounded-3xl bg-gradient-card border border-border/60 p-5 sm:p-7">
        <h2 className="font-bold text-base sm:text-lg leading-snug">{q.question}</h2>
        <div className="mt-4 space-y-2">
          {q.options.map((opt) => {
            const isPicked = picked === opt;
            const isCorrect = revealed && opt === q.correct;
            const isWrong = revealed && isPicked && opt !== q.correct;
            return (
              <button key={opt} onClick={()=> !revealed && setPicked(opt)} disabled={revealed}
                className={`w-full text-left rounded-2xl border p-3 sm:p-4 text-sm font-semibold transition ${
                  isCorrect ? "bg-success/15 border-success text-success" :
                  isWrong ? "bg-destructive/15 border-destructive text-destructive" :
                  isPicked ? "bg-primary/15 border-primary" : "bg-background/40 border-border/50 hover:border-primary/40"}`}>
                {opt}
              </button>
            );
          })}
        </div>

        {revealed && grade && (
          <div className="mt-4 rounded-2xl bg-background/40 border border-border/50 p-3 sm:p-4 text-sm">
            <div className="text-xs font-extrabold uppercase tracking-wider">Critic Agent feedback</div>
            <p className="mt-1.5">{grade.feedback}</p>
            {grade.explanation && <p className="mt-2 text-muted-foreground"><span className="font-bold text-foreground">Why:</span> {grade.explanation}</p>}
          </div>
        )}

        <div className="mt-5">
          {!revealed ? (
            <Button onClick={submit} disabled={!picked || loading} className="w-full bg-gradient-primary text-primary-foreground shadow-glow font-bold">
              {loading ? <Loader2 className="size-4 animate-spin"/> : "Submit"}
            </Button>
          ) : (
            <Button onClick={next} className="w-full bg-gradient-primary text-primary-foreground shadow-glow font-bold">
              {idx + 1 >= questions.length ? "Finish" : "Next question"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function ModeBtn({ active, onClick, children }: any) {
  return <button onClick={onClick} className={`px-3 py-1.5 rounded-full text-xs font-bold border capitalize ${active ? "bg-gradient-primary text-primary-foreground border-transparent shadow-glow" : "bg-secondary text-secondary-foreground border-border"}`}>{children}</button>;
}
