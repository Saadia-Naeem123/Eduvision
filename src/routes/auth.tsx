import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth")({ component: AuthPage });

function AuthPage() {
  const { user } = useAuth();
  useEffect(() => { if (user && typeof window !== "undefined") window.location.href = "/app"; }, [user]);

  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  const signIn = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) toast.error(error.message); else toast.success("Welcome back!");
  };
  const signUp = async () => {
    const trimmed = name.trim();
    if (!trimmed) return toast.error("Please enter your name.");
    if (!/^[A-Za-z][A-Za-z\s.'-]{1,59}$/.test(trimmed)) {
      return toast.error("Name must be letters only (no numbers or symbols).");
    }
    if (!email.trim()) return toast.error("Please enter your email.");
    if (password.length < 6) return toast.error("Password must be at least 6 characters.");
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(), password,
      options: { emailRedirectTo: `${window.location.origin}/app`, data: { full_name: trimmed } },
    });
    setLoading(false);
    if (error) {
      // Friendly message for duplicate email
      if (/registered|exists|already/i.test(error.message)) {
        toast.error("An account with this email already exists. Please sign in instead.");
      } else {
        toast.error(error.message);
      }
    } else toast.success("Check your email to confirm your account.");
  };
  const google = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/app` },
    });
    if (error) toast.error(error.message);
    setLoading(false);
  };

  return (
    <div className="min-h-screen grid place-items-center px-4 py-10">
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-baseline justify-center gap-2 mb-6">
          <div className="text-2xl font-extrabold tracking-tight">EduVision</div>
          <div className="text-xs text-muted-foreground font-semibold uppercase tracking-widest">mentorship</div>
        </Link>

        <div className="rounded-3xl bg-gradient-card border border-border/60 p-6 shadow-elevated">
          <Tabs defaultValue="signin">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="signin" className="font-bold">Sign in</TabsTrigger>
              <TabsTrigger value="signup" className="font-bold">Sign up</TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="mt-5 space-y-3">
              <div><Label className="font-bold">Email</Label><Input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="you@example.com"/></div>
              <div><Label className="font-bold">Password</Label><Input type="password" value={password} onChange={(e)=>setPassword(e.target.value)}/></div>
              <Button className="w-full bg-gradient-primary text-primary-foreground shadow-glow font-bold" onClick={signIn} disabled={loading}>
                {loading ? <Loader2 className="size-4 animate-spin"/> : "Sign in"}
              </Button>
            </TabsContent>

            <TabsContent value="signup" className="mt-5 space-y-3">
              <div><Label className="font-bold">Full name</Label><Input value={name} onChange={(e)=>setName(e.target.value.replace(/[0-9]/g, ""))} placeholder="Letters only" pattern="[A-Za-z\s.'-]+"/></div>
              <div><Label className="font-bold">Email</Label><Input type="email" value={email} onChange={(e)=>setEmail(e.target.value)}/></div>
              <div><Label className="font-bold">Password</Label><Input type="password" value={password} onChange={(e)=>setPassword(e.target.value)}/></div>
              <Button className="w-full bg-gradient-primary text-primary-foreground shadow-glow font-bold" onClick={signUp} disabled={loading}>
                {loading ? <Loader2 className="size-4 animate-spin"/> : "Create account"}
              </Button>
            </TabsContent>
          </Tabs>

          <div className="my-5 flex items-center gap-3 text-xs font-semibold text-muted-foreground">
            <div className="h-px flex-1 bg-border"/>OR<div className="h-px flex-1 bg-border"/>
          </div>
          <Button variant="outline" className="w-full font-bold" onClick={google} disabled={loading}>
            Continue with Google
          </Button>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-4">By continuing you agree to our Terms.</p>
      </div>
    </div>
  );
}
