import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const { user, loading } = useAuth();
  useEffect(() => {
    if (!loading && user && typeof window !== "undefined") window.location.href = "/app";
  }, [user, loading]);

  const features = [
    { title: "Adaptive quizzes", text: "Difficulty adjusts to your mastery." },
    { title: "Upload your notes", text: "PDFs, photos of textbook pages." },
    { title: "Critic Agent", text: "AI verifies every answer for accuracy." },
    { title: "Tutor chat", text: "Ask anything. Get grade appropriate explanations." },
    { title: "Performance tracking", text: "See your mastery curve per topic." },
    { title: "Smart recommendations", text: "AI suggests what to study next." },
  ];

  return (
    <div className="min-h-screen">
      <header className="mx-auto max-w-6xl px-5 sm:px-8 py-5 flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <div className="text-lg sm:text-xl font-extrabold tracking-tight">EduVision</div>
          <div className="text-[11px] sm:text-xs text-muted-foreground font-semibold uppercase tracking-widest">mentorship</div>
        </div>
        <Link to="/auth"><Button size="sm" variant="ghost" className="font-bold">Sign in</Button></Link>
      </header>

      <section className="mx-auto max-w-4xl px-5 sm:px-8 pt-8 pb-16 text-center">
        <div className="inline-flex items-center gap-2 rounded-full glass px-3 py-1 text-xs font-semibold text-muted-foreground">
          <span className="size-1.5 rounded-full bg-success animate-pulse" /> Agentic AI tutor with Critic Agent verification
        </div>
        <h1 className="mt-5 text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.05]">
          Your <span className="text-gradient">personal AI mentor</span>
        </h1>
        <p className="mt-5 text-base sm:text-lg lg:text-xl text-muted-foreground max-w-2xl mx-auto">
          EduVision explains topics, generates adaptive quizzes, reads your notes (PDFs, photos)  and a Critic Agent cross verifies every response.
        </p>
        <div className="mt-7 flex items-center justify-center gap-3 flex-wrap">
          <Link to="/auth"><Button size="lg" variant="outline" className="font-bold">Sign in</Button></Link>
        </div>

        <div className="mt-14 grid sm:grid-cols-2 lg:grid-cols-3 gap-4 text-left">
          {features.map((f, i) => (
            <div key={i} className="rounded-2xl bg-gradient-card border border-border/60 p-5">
              <div className="font-bold text-base">{f.title}</div>
              <div className="text-sm text-muted-foreground mt-2">{f.text}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
