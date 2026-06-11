import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error || !data) throw new Error("Acesso negado.");
}

export const setMatchResult = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    match_id: z.string().uuid(),
    home_score: z.number().int().min(0),
    away_score: z.number().int().min(0),
    status: z.enum(["scheduled","live","finished"]).default("finished"),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("matches")
      .update({ home_score: data.home_score, away_score: data.away_score, status: data.status })
      .eq("id", data.match_id);
    if (error) throw error;
    return { ok: true };
  });

export const updateMatchTeams = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    match_id: z.string().uuid(),
    home_team_id: z.string().uuid().nullable(),
    away_team_id: z.string().uuid().nullable(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("matches")
      .update({ home_team_id: data.home_team_id, away_team_id: data.away_team_id })
      .eq("id", data.match_id);
    if (error) throw error;
    return { ok: true };
  });

function pointsForGroup(pred: { h: number; a: number }, res: { h: number; a: number }) {
  if (pred.h === res.h && pred.a === res.a) return 10;
  const predWinner = pred.h === pred.a ? 0 : pred.h > pred.a ? 1 : -1;
  const resWinner = res.h === res.a ? 0 : res.h > res.a ? 1 : -1;
  if (predWinner === resWinner && resWinner === 0) return 5; // both empate
  if (predWinner === resWinner) {
    if (pred.h === res.h || pred.a === res.a) return 7;
    return 5;
  }
  if (pred.h === res.h || pred.a === res.a) return 2;
  return 0;
}
function pointsForKO(pred: { h: number; a: number }, res: { h: number; a: number }) {
  if (pred.h === res.h && pred.a === res.a) return 15;
  const predWinner = pred.h === pred.a ? 0 : pred.h > pred.a ? 1 : -1;
  const resWinner = res.h === res.a ? 0 : res.h > res.a ? 1 : -1;
  if (predWinner === resWinner && resWinner !== 0) return 8;
  if (pred.h === res.h || pred.a === res.a) return 3;
  return 0;
}
const TP_POINTS: Record<string, number> = {
  group_1st: 5, group_2nd: 5, r16: 3, qf: 5, sf: 8, finalist: 12, champion: 30, runner_up: 15, third: 10,
};

export const recalculateAll = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin: supabase } = await import("@/integrations/supabase/client.server");

    // 1) Match points
    const { data: matches } = await supabase.from("matches").select("id,phase,home_score,away_score,status").eq("status","finished");
    const matchMap = new Map<string, { phase: string; h: number; a: number }>();
    for (const m of matches ?? []) {
      if (m.home_score == null || m.away_score == null) continue;
      matchMap.set(m.id, { phase: m.phase, h: m.home_score, a: m.away_score });
    }

    const { data: preds } = await supabase.from("predictions").select("id,user_id,match_id,home_score,away_score");
    const userPoints = new Map<string, number>();
    const userHits = new Map<string, number>();
    const predUpdates: { id: string; points: number }[] = [];
    for (const p of preds ?? []) {
      const m = matchMap.get(p.match_id);
      let pts = 0;
      if (m) {
        pts = m.phase === "group"
          ? pointsForGroup({ h: p.home_score, a: p.away_score }, { h: m.h, a: m.a })
          : pointsForKO({ h: p.home_score, a: p.away_score }, { h: m.h, a: m.a });
      }
      predUpdates.push({ id: p.id, points: pts });
      userPoints.set(p.user_id, (userPoints.get(p.user_id) ?? 0) + pts);
      if (pts > 0) userHits.set(p.user_id, (userHits.get(p.user_id) ?? 0) + 1);
    }

    // batch update predictions
    for (const u of predUpdates) {
      await supabase.from("predictions").update({ points: u.points }).eq("id", u.id);
    }

    // 2) Tournament predictions
    const { data: tres } = await supabase.from("tournament_results").select("result_type,group_letter,team_id");
    const resSet = new Set<string>((tres ?? []).map((r) => `${r.result_type}|${r.group_letter ?? ""}|${r.team_id}`));

    const { data: tps } = await supabase.from("tournament_predictions").select("id,user_id,pred_type,group_letter,team_id");
    for (const tp of tps ?? []) {
      const key = `${tp.pred_type}|${tp.group_letter ?? ""}|${tp.team_id}`;
      const pts = resSet.has(key) ? (TP_POINTS[tp.pred_type] ?? 0) : 0;
      await supabase.from("tournament_predictions").update({ points: pts }).eq("id", tp.id);
      userPoints.set(tp.user_id, (userPoints.get(tp.user_id) ?? 0) + pts);
      if (pts > 0) userHits.set(tp.user_id, (userHits.get(tp.user_id) ?? 0) + 1);
    }

    // 3) Update profiles
    const { data: profiles } = await supabase.from("profiles").select("id,total_points");
    for (const p of profiles ?? []) {
      const newPts = userPoints.get(p.id) ?? 0;
      const newHits = userHits.get(p.id) ?? 0;
      await supabase.from("profiles").update({
        total_points: newPts,
        total_hits: newHits,
        prev_rank: null,
      }).eq("id", p.id);
    }

    return { ok: true, profiles: profiles?.length ?? 0 };
  });

export const setTournamentResult = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    result_type: z.enum(["group_1st","group_2nd","r16","qf","sf","finalist","champion","runner_up","third"]),
    group_letter: z.string().nullable().optional(),
    team_id: z.string().uuid(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("tournament_results").insert({
      result_type: data.result_type,
      group_letter: data.group_letter ?? null,
      team_id: data.team_id,
    });
    if (error) throw error;
    return { ok: true };
  });

export const toggleUserBlock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ user_id: z.string().uuid(), blocked: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("profiles").update({ blocked: data.blocked }).eq("id", data.user_id);
    if (error) throw error;
    return { ok: true };
  });

// ---------- Admin user management ----------

export const listAdminUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [profilesRes, predsRes, authRes] = await Promise.all([
      supabaseAdmin.from("profiles").select("*").order("total_points", { ascending: false }),
      supabaseAdmin.from("predictions").select("user_id"),
      supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ]);
    const counts = new Map<string, number>();
    for (const p of predsRes.data ?? []) counts.set(p.user_id, (counts.get(p.user_id) ?? 0) + 1);
    const authMap = new Map<string, { email: string | undefined; created_at: string }>();
    for (const u of authRes.data?.users ?? []) authMap.set(u.id, { email: u.email, created_at: u.created_at });

    return (profilesRes.data ?? []).map((p: any) => ({
      ...p,
      email: authMap.get(p.id)?.email ?? null,
      auth_created_at: authMap.get(p.id)?.created_at ?? p.created_at,
      predictions_count: counts.get(p.id) ?? 0,
    }));
  });

export const adminUpdateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      user_id: z.string().uuid(),
      full_name: z.string().min(1).optional(),
      nickname: z.string().min(1).optional(),
      email: z.string().email().optional(),
      password: z.string().min(6).optional(),
      blocked: z.boolean().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const profilePatch: any = {};
    if (data.full_name !== undefined) profilePatch.full_name = data.full_name;
    if (data.nickname !== undefined) profilePatch.nickname = data.nickname;
    if (data.blocked !== undefined) profilePatch.blocked = data.blocked;
    if (Object.keys(profilePatch).length) {
      const { error } = await supabaseAdmin.from("profiles").update(profilePatch).eq("id", data.user_id);
      if (error) throw error;
    }

    const authPatch: any = {};
    if (data.email) authPatch.email = data.email;
    if (data.password) authPatch.password = data.password;
    if (Object.keys(authPatch).length) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, authPatch);
      if (error) throw error;
    }
    return { ok: true };
  });

export const adminDeleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ user_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.user_id === context.userId) throw new Error("Você não pode excluir a si mesmo.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Deleting from auth.users cascades to public.profiles (FK on delete cascade);
    // related predictions / achievements / tournament_predictions cascade via profile FK chain.
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) throw error;
    return { ok: true };
  });

// ---------- Football-Data.org sync ----------

export const syncResultsNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { syncFootballDataResults } = await import("@/lib/api/sync-results.server");
    return await syncFootballDataResults();
  });