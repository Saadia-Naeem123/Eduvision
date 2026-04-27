import { createFileRoute, Outlet, redirect, Link } from "@tanstack/react-router";
import { MobileNav } from "@/components/MobileNav";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function AppLayout() {
  const { user, loading, signOut } = useAuth();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  }
  if (!user) {
    // client-side redirect (root has no router context for beforeLoad on auth here)
    if (typeof window !== "undefined") window.location.href = "/auth";
    return null;
  }

  return (
    <div className="min-h-screen pb-24">
      <header className="sticky top-0 z-40 glass border-b border-border/60">
        <div className="mx-auto max-w-5xl flex items-center justify-between px-4 sm:px-6 py-3">
          <Link to="/app" className="flex items-baseline gap-2">
            <div className="text-base sm:text-lg font-extrabold tracking-tight">EduVision</div>
            <div className="text-[10px] sm:text-xs text-muted-foreground font-semibold uppercase tracking-widest">mentorship</div>
          </Link>
          <Button variant="ghost" size="sm" onClick={signOut} className="text-xs sm:text-sm font-bold">
            Sign out
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 sm:px-6 py-4 sm:py-6">
        <Outlet />
      </main>
      <MobileNav />
    </div>
  );
}
