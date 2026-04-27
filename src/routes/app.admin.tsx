import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/app/admin")({ component: AdminPage });

function AdminPage() {
  const { isAdmin, loading } = useAuth();
  const [stats, setStats] = useState<any>({ users: 0, materials: 0, attempts: 0, topics: 0 });
  const [topics, setTopics] = useState<any[]>([]);
  const [newTopic, setNewTopic] = useState({ subject: "", grade: "10", title: "", summary: "", difficulty: "medium" });

  useEffect(() => {
    if (!isAdmin) return;
    Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("materials").select("id", { count: "exact", head: true }),
      supabase.from("quiz_attempts").select("id", { count: "exact", head: true }),
      supabase.from("topics").select("*").order("created_at",{ascending:false}),
    ]).then(([u,m,a,t]) => {
      setStats({ users: u.count ?? 0, materials: m.count ?? 0, attempts: a.count ?? 0, topics: t.data?.length ?? 0 });
      setTopics(t.data ?? []);
    });
  }, [isAdmin]);

  const addTopic = async () => {
    if (!newTopic.title || !newTopic.subject) return toast.error("Subject and title required");
    const { error } = await supabase.from("topics").insert(newTopic);
    if (error) return toast.error(error.message);
    toast.success("Topic added");
    setNewTopic({ subject: "", grade: "10", title: "", summary: "", difficulty: "medium" });
    const { data: t } = await supabase.from("topics").select("*").order("created_at",{ascending:false});
    setTopics(t ?? []);
  };

  if (loading) return <div className="text-muted-foreground">Loading…</div>;
  if (!isAdmin) return (
    <div className="rounded-3xl bg-gradient-card border border-border/60 p-6 sm:p-10 text-center max-w-xl mx-auto">
      <h2 className="font-extrabold text-xl">Admin only</h2>
      <p className="text-sm text-muted-foreground mt-2">Your account doesn't have admin access.</p>
      <p className="text-xs text-muted-foreground mt-3">Ask an existing admin to grant you the role from the Lovable Cloud dashboard.</p>
      <Link to="/app" className="mt-4 inline-block text-sm text-primary font-bold">← Back</Link>
    </div>
  );

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <h1 className="text-2xl sm:text-3xl font-extrabold">Admin panel</h1>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        {Object.entries(stats).map(([k,v])=> (
          <div key={k} className="rounded-2xl bg-gradient-card border border-border/60 p-3 sm:p-4 text-center">
            <div className="text-xl sm:text-2xl font-extrabold">{String(v)}</div>
            <div className="text-[10px] sm:text-xs uppercase tracking-wider font-bold text-muted-foreground">{k}</div>
          </div>
        ))}
      </div>

      <section className="rounded-3xl bg-gradient-card border border-border/60 p-5 sm:p-7">
        <h2 className="font-extrabold text-lg">Add a topic</h2>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2"><Label className="font-bold">Title</Label><Input value={newTopic.title} onChange={(e)=>setNewTopic({...newTopic, title: e.target.value})}/></div>
          <div><Label className="font-bold">Subject</Label><Input value={newTopic.subject} onChange={(e)=>setNewTopic({...newTopic, subject: e.target.value})}/></div>
          <div><Label className="font-bold">Grade</Label><Input value={newTopic.grade} onChange={(e)=>setNewTopic({...newTopic, grade: e.target.value})}/></div>
          <div className="sm:col-span-2"><Label className="font-bold">Summary</Label><Input value={newTopic.summary} onChange={(e)=>setNewTopic({...newTopic, summary: e.target.value})}/></div>
          <div><Label className="font-bold">Difficulty</Label>
            <select value={newTopic.difficulty} onChange={(e)=>setNewTopic({...newTopic, difficulty: e.target.value})} className="mt-1 w-full rounded-md bg-input border border-border px-3 py-2 text-sm">
              <option>easy</option><option>medium</option><option>hard</option>
            </select>
          </div>
        </div>
        <Button onClick={addTopic} className="mt-4 bg-gradient-primary text-primary-foreground shadow-glow font-bold">Add topic</Button>
      </section>

      <section>
        <h2 className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground mb-2 px-1">All topics</h2>
        <ul className="grid sm:grid-cols-2 gap-2 sm:gap-3">
          {topics.map((t)=> (
            <li key={t.id} className="rounded-2xl bg-gradient-card border border-border/60 p-3 sm:p-4 text-sm">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-bold">{t.title}</div>
                  <div className="text-[11px] text-muted-foreground font-semibold">{t.subject} • Grade {t.grade}</div>
                </div>
                <Badge variant="outline" className="text-[10px] font-bold">{t.difficulty}</Badge>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
