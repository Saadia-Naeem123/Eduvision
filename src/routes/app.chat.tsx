import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Send, Loader2, ShieldCheck, Image as ImageIcon, X, Sparkles, FileText, Paperclip, Plus, MessageSquare, Trash2, PanelLeft, Pencil, Check } from "lucide-react";
import { RichMarkdown } from "@/components/RichMarkdown";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/app/chat")({ component: ChatPage });

type Msg = { role: "user" | "assistant"; content: any; critic?: any };
type Session = { id: string; title: string; created_at: string };

const WELCOME: Msg = { role: "assistant", content: "Hi! I'm **EduVision** your tutor. Ask me anything attach a photo of your notes, or  link a study material so I can ground my answer in it.", critic: null };

function ChatPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [materials, setMaterials] = useState<any[]>([]);
  const [attachedMaterials, setAttachedMaterials] = useState<any[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load profile + materials once
  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("grade,subjects").eq("id", user.id).single().then(({data})=>setProfile(data));
    supabase.from("materials").select("id,title,status,mime_type").eq("user_id", user.id).order("created_at",{ascending:false}).limit(20).then(({data})=>setMaterials(data ?? []));
  }, [user?.id]);

  // Load all sessions; pick most recent or create one
  const loadSessions = async (preferId?: string) => {
    if (!user) return;
    const { data } = await supabase.from("chat_sessions")
      .select("id,title,created_at").eq("user_id", user.id)
      .order("created_at", { ascending: false }).limit(50);
    const list = (data ?? []) as Session[];
    setSessions(list);
    if (preferId && list.find(s => s.id === preferId)) { setSessionId(preferId); return; }
    if (list.length === 0) {
      const { data: created } = await supabase.from("chat_sessions")
        .insert({ user_id: user.id, title: "New chat" }).select("id,title,created_at").single();
      if (created) { setSessions([created as Session]); setSessionId(created.id); }
    } else if (!sessionId) {
      setSessionId(list[0].id);
    }
  };

  useEffect(() => { if (user) loadSessions(); }, [user?.id]);

  // Load messages whenever active session changes
  useEffect(() => {
    if (!sessionId) return;
    (async () => {
      const { data: history } = await supabase
        .from("chat_messages").select("role,content,attachments,critic_notes,created_at")
        .eq("session_id", sessionId).order("created_at", { ascending: true }).limit(200);
      if (!history || history.length === 0) { setMessages([WELCOME]); return; }
      const restored: Msg[] = history.map((row: any) => {
        let content: any = row.content;
        if (row.attachments?.image_url) {
          content = [
            { type: "text", text: row.content || "" },
            { type: "image_url", image_url: { url: row.attachments.image_url } },
          ];
        }
        let critic: any = null;
        if (row.critic_notes) { try { critic = JSON.parse(row.critic_notes); } catch { critic = null; } }
        return { role: row.role, content, critic };
      });
      setMessages([WELCOME, ...restored]);
    })();
  }, [sessionId]);

  const persistMessage = async (sid: string, role: "user"|"assistant", content: any, critic?: any) => {
    if (!user) return;
    let text = "";
    let attachments: any = null;
    if (typeof content === "string") {
      text = content;
    } else if (Array.isArray(content)) {
      text = content.find((p: any) => p.type === "text")?.text ?? "";
      const img = content.find((p: any) => p.type === "image_url");
      if (img?.image_url?.url) attachments = { image_url: img.image_url.url };
    }
    await supabase.from("chat_messages").insert({
      session_id: sid, user_id: user.id, role, content: text,
      attachments, critic_notes: critic ? JSON.stringify(critic) : null,
    });
  };

  const newChat = async () => {
    if (!user) return;
    const { data: created } = await supabase.from("chat_sessions")
      .insert({ user_id: user.id, title: "New chat" }).select("id,title,created_at").single();
    if (created) {
      setSessions((prev) => [created as Session, ...prev]);
      setSessionId(created.id);
      setMessages([WELCOME]);
      setSidebarOpen(false);
    }
  };

  const deleteSession = async (id: string) => {
    if (!user) return;
    await supabase.from("chat_messages").delete().eq("session_id", id);
    await supabase.from("chat_sessions").delete().eq("id", id);
    const remaining = sessions.filter(s => s.id !== id);
    setSessions(remaining);
    if (sessionId === id) {
      if (remaining.length > 0) setSessionId(remaining[0].id);
      else { setSessionId(null); await loadSessions(); }
    }
  };

  const startRename = (s: Session) => { setRenamingId(s.id); setRenameValue(s.title); };
  const commitRename = async () => {
    if (!renamingId) return;
    const title = renameValue.trim() || "Untitled chat";
    await supabase.from("chat_sessions").update({ title }).eq("id", renamingId);
    setSessions((prev) => prev.map(s => s.id === renamingId ? { ...s, title } : s));
    setRenamingId(null);
  };

  const switchSession = (id: string) => { setSessionId(id); setSidebarOpen(false); };

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages, loading]);

  // Auto-prefill + send when navigated from Topics page
  const autoSentRef = useRef(false);
  useEffect(() => {
    if (autoSentRef.current) return;
    const prefill = typeof window !== "undefined" ? sessionStorage.getItem("eduvision:tutor:prefill") : null;
    const auto = typeof window !== "undefined" ? sessionStorage.getItem("eduvision:tutor:autosend") : null;
    if (prefill && sessionId) {
      sessionStorage.removeItem("eduvision:tutor:prefill");
      sessionStorage.removeItem("eduvision:tutor:autosend");
      setInput(prefill);
      if (auto && profile !== null) {
        autoSentRef.current = true;
        setTimeout(() => sendWithText(prefill), 50);
      }
    }
  }, [profile, sessionId]);

  const onPickImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    if (f.size > 5 * 1024 * 1024) return toast.error("Image must be under 5MB");
    const reader = new FileReader();
    reader.onload = () => setImageDataUrl(reader.result as string);
    reader.readAsDataURL(f);
  };

  const toggleMaterial = (m: any) => {
    setAttachedMaterials((prev) => prev.find(x=>x.id===m.id) ? prev.filter(x=>x.id!==m.id) : [...prev, m]);
  };

  const send = () => sendWithText(input);

  const sendWithText = async (text: string) => {
    if (!text.trim() && !imageDataUrl) return;
    if (!sessionId) return;
    const userContent: any = imageDataUrl
      ? [{ type: "text", text: text || "Please explain this." }, { type: "image_url", image_url: { url: imageDataUrl } }]
      : text;
    const next = [...messages, { role: "user" as const, content: userContent }];
    setMessages(next); setInput(""); setImageDataUrl(null); setLoading(true);

    await persistMessage(sessionId, "user", userContent);

    // Auto-title the session from the first user message
    const currentSession = sessions.find(s => s.id === sessionId);
    if (currentSession && (currentSession.title === "New chat" || currentSession.title === "Tutor chat")) {
      const newTitle = text.replace(/\s+/g, " ").trim().slice(0, 48) || "New chat";
      await supabase.from("chat_sessions").update({ title: newTitle }).eq("id", sessionId);
      setSessions((prev) => prev.map(s => s.id === sessionId ? { ...s, title: newTitle } : s));
    }

    const { data: { session } } = await supabase.auth.getSession();
    const { data, error } = await supabase.functions.invoke("tutor-chat", {
      headers: { Authorization: `Bearer ${session?.access_token}` },
      body: {
        messages: next.map(m=>({ role: m.role, content: m.content })),
        grade: profile?.grade,
        subject: profile?.subjects?.[0],
        materialIds: attachedMaterials.map(m=>m.id),
      },
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    if (data.error) { toast.error(data.error); return; }
    setMessages([...next, { role: "assistant", content: data.answer, critic: data.critic }]);
    await persistMessage(sessionId, "assistant", data.answer, data.critic);
  };

  const SidebarBody = (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-border/60">
        <Button onClick={newChat} className="w-full bg-gradient-primary text-primary-foreground font-bold gap-2">
          <Plus className="size-4"/> New chat
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {sessions.length === 0 && <p className="text-xs text-muted-foreground p-3">No chats yet.</p>}
        {sessions.map((s) => {
          const active = s.id === sessionId;
          const isRenaming = renamingId === s.id;
          return (
            <div key={s.id} className={`group flex items-center gap-1.5 rounded-lg px-2 py-2 text-xs ${active ? "bg-primary/15 border border-primary/30" : "hover:bg-muted/60 border border-transparent"}`}>
              <MessageSquare className={`size-3.5 shrink-0 ${active ? "text-primary" : "text-muted-foreground"}`}/>
              {isRenaming ? (
                <>
                  <Input value={renameValue} onChange={(e)=>setRenameValue(e.target.value)}
                    onKeyDown={(e)=>{ if(e.key==="Enter") commitRename(); if(e.key==="Escape") setRenamingId(null); }}
                    autoFocus className="h-6 text-xs px-1.5"/>
                  <button onClick={commitRename} className="text-primary p-1"><Check className="size-3"/></button>
                </>
              ) : (
                <>
                  <button onClick={()=>switchSession(s.id)} className="flex-1 text-left truncate font-semibold">
                    {s.title || "Untitled"}
                  </button>
                  <button onClick={()=>startRename(s)} className="opacity-0 group-hover:opacity-100 hover:text-primary p-1" title="Rename"><Pencil className="size-3"/></button>
                  <button onClick={()=>{ if (confirm("Delete this chat?")) deleteSession(s.id); }} className="opacity-0 group-hover:opacity-100 hover:text-destructive p-1" title="Delete"><Trash2 className="size-3"/></button>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="flex gap-4 h-[calc(100vh-180px)] max-w-6xl mx-auto w-full">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 shrink-0 rounded-2xl bg-gradient-card border border-border/60 overflow-hidden">
        {SidebarBody}
      </aside>

      {/* Chat column */}
      <div className="flex flex-col flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1 gap-2">
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm" className="md:hidden gap-1.5 font-bold text-xs">
                <PanelLeft className="size-4"/> Chats
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-72 bg-card">{SidebarBody}</SheetContent>
          </Sheet>
          <div className="flex-1 min-w-0 text-xs font-bold truncate text-muted-foreground hidden md:block">
            {sessions.find(s=>s.id===sessionId)?.title ?? "Chat"}
          </div>
          <Button onClick={newChat} variant="ghost" size="sm" className="md:hidden gap-1.5 font-bold text-xs"><Plus className="size-4"/> New</Button>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 pb-3">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[88%] rounded-2xl px-4 py-2.5 ${m.role === "user" ? "bg-gradient-primary text-primary-foreground" : "bg-gradient-card border border-border/60"}`}>
                {Array.isArray(m.content) ? (
                  <>
                    {m.content.find((p:any)=>p.type==="image_url") && <img src={m.content.find((p:any)=>p.type==="image_url").image_url.url} className="rounded-lg mb-2 max-h-48"/>}
                    <div className="text-sm whitespace-pre-wrap">{m.content.find((p:any)=>p.type==="text")?.text}</div>
                  </>
                ) : m.role === "assistant" ? (
                  <RichMarkdown content={m.content} />
                ) : (
                  <div className="text-sm whitespace-pre-wrap">{m.content}</div>
                )}
                {m.role === "assistant" && m.critic && (
                  <div className="mt-3 pt-2 border-t border-border/50 text-[11px] flex items-center gap-2 flex-wrap text-muted-foreground">
                    <ShieldCheck className="size-3 text-success"/>
                    <span className="font-semibold">Critic:</span>
                    <Badge variant="outline" className="text-[10px] py-0">{m.critic.verdict}</Badge>
                    <span>{Math.round((m.critic.confidence ?? 0)*100)}%</span>
                    {m.critic.issues?.length > 0 && (
                      <span className="basis-full text-[10px] opacity-80">⚠ {m.critic.issues.join(" · ")}</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
          {loading && <div className="flex justify-start"><div className="rounded-2xl bg-gradient-card border border-border/60 px-4 py-2.5"><Loader2 className="size-4 animate-spin text-primary"/></div></div>}
        </div>

        <div className="sticky bottom-0 pt-2 bg-gradient-hero">
          {(imageDataUrl || attachedMaterials.length > 0) && (
            <div className="flex flex-wrap gap-2 mb-2">
              {imageDataUrl && (
                <div className="relative inline-block">
                  <img src={imageDataUrl} className="h-14 rounded-lg"/>
                  <button onClick={()=>setImageDataUrl(null)} className="absolute -top-1.5 -right-1.5 bg-destructive rounded-full p-0.5"><X className="size-3"/></button>
                </div>
              )}
              {attachedMaterials.map((m) => (
                <div key={m.id} className="relative inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary/15 border border-primary/30 text-xs">
                  <FileText className="size-3"/>
                  <span className="max-w-[120px] truncate">{m.title}</span>
                  <button onClick={()=>toggleMaterial(m)} className="hover:text-destructive"><X className="size-3"/></button>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-end gap-1.5 rounded-2xl bg-gradient-card border border-border/60 p-2">
            <label className="cursor-pointer p-2 text-muted-foreground hover:text-primary">
              <ImageIcon className="size-5"/>
              <input type="file" accept="image/*" className="hidden" onChange={onPickImage}/>
            </label>
            <Popover>
              <PopoverTrigger asChild>
                <button type="button" className="p-2 text-muted-foreground hover:text-primary relative">
                  <Paperclip className="size-5"/>
                  {attachedMaterials.length > 0 && <span className="absolute -top-0.5 -right-0.5 bg-primary text-primary-foreground text-[9px] rounded-full size-4 grid place-items-center font-bold">{attachedMaterials.length}</span>}
                </button>
              </PopoverTrigger>
              <PopoverContent side="top" align="start" className="w-72 p-2 bg-card border-border/60 max-h-72 overflow-y-auto">
                <div className="text-xs font-semibold mb-2 px-1 text-muted-foreground">Ground answer in your materials</div>
                {materials.length === 0 ? (
                  <p className="text-xs text-muted-foreground p-2">Upload Material here.</p>
                ) : materials.map((m) => {
                  const on = !!attachedMaterials.find(x=>x.id===m.id);
                  return (
                    <button key={m.id} onClick={()=>toggleMaterial(m)} className={`w-full text-left flex items-center gap-2 p-2 rounded-lg text-xs hover:bg-primary/10 ${on ? "bg-primary/15" : ""}`}>
                      <FileText className="size-3.5 shrink-0 text-primary"/>
                      <span className="truncate flex-1">{m.title}</span>
                      {m.status !== "analyzed" && <Badge variant="secondary" className="text-[9px]">pending</Badge>}
                      {on && <span className="text-primary text-[10px]">✓</span>}
                    </button>
                  );
                })}
              </PopoverContent>
            </Popover>
            <Textarea value={input} onChange={(e)=>setInput(e.target.value)} placeholder="Ask anything…"
              onKeyDown={(e)=>{ if(e.key==="Enter" && !e.shiftKey){ e.preventDefault(); send(); } }}
              className="min-h-[40px] max-h-32 resize-none border-0 bg-transparent focus-visible:ring-0 p-2"/>
            <Button onClick={send} disabled={loading || (!input.trim() && !imageDataUrl)} size="icon" className="bg-gradient-primary text-primary-foreground shadow-glow shrink-0">
              {loading ? <Loader2 className="size-4 animate-spin"/> : <Send className="size-4"/>}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground text-center mt-1.5 flex items-center justify-center gap-1">Every answer cross-verified by the Critic Agent</p>
        </div>
      </div>
    </div>
  );
}
