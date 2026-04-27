import { Link, useLocation } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

const items = [
  { to: "/app", label: "Home" },
  { to: "/app/topics", label: "Topics" },
  { to: "/app/quiz", label: "Quiz" },
  { to: "/app/chat", label: "Tutor" },
  { to: "/app/performance", label: "Stats" },
  { to: "/app/materials", label: "Notes" },
] as const;

export function MobileNav() {
  const loc = useLocation();
  const { isAdmin } = useAuth();
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 glass border-t border-border/60 pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto max-w-5xl grid grid-cols-6 px-2 py-2 gap-1">
        {items.map((it) => {
          const active = loc.pathname === it.to || (it.to !== "/app" && loc.pathname.startsWith(it.to));
          return (
            <Link
              key={it.to}
              to={it.to}
              className={cn(
                "flex items-center justify-center rounded-xl py-2.5 text-xs sm:text-sm font-bold tracking-wide transition-colors",
                active ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-secondary/40",
              )}
            >
              {it.label}
            </Link>
          );
        })}
      </div>
      {isAdmin && (
        <Link to="/app/admin" className="absolute -top-3 right-3 inline-flex items-center rounded-full bg-gradient-primary px-3 py-1 text-[11px] font-bold text-primary-foreground shadow-glow">
          Admin
        </Link>
      )}
    </nav>
  );
}

export function TopBar({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-30 glass border-b border-border/60 px-4 py-3 flex items-center justify-between">
      <h1 className="text-lg font-bold tracking-tight">{title}</h1>
      {action}
    </header>
  );
}
