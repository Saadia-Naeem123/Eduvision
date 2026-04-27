// Centralized XP + streak logic.
// Streak logic:
//  - Track last_active_date via profiles.updated_at (date portion).
//  - Same day → no change.
//  - Yesterday → streak += 1.
//  - Older or never → streak = 1.
// XP awards are added on top, callers pass an `xp` delta (>=0).

import { supabase } from "@/integrations/supabase/client";

const dayKey = (d: Date) => d.toISOString().slice(0, 10);

export async function awardActivity(userId: string, xp: number = 0): Promise<void> {
  const { data: p } = await supabase
    .from("profiles")
    .select("total_xp,streak_days,updated_at")
    .eq("id", userId)
    .maybeSingle();
  if (!p) return;

  const today = dayKey(new Date());
  const last = p.updated_at ? dayKey(new Date(p.updated_at)) : null;

  let nextStreak = p.streak_days ?? 0;
  if (last === today) {
    // already active today — keep streak
    if (nextStreak < 1) nextStreak = 1;
  } else {
    const yesterday = dayKey(new Date(Date.now() - 24 * 60 * 60 * 1000));
    nextStreak = last === yesterday ? (nextStreak || 0) + 1 : 1;
  }

  await supabase
    .from("profiles")
    .update({
      total_xp: (p.total_xp ?? 0) + Math.max(0, Math.floor(xp)),
      streak_days: nextStreak,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);
}
