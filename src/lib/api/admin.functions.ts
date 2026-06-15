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

export const recalculateAll = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin: supabase } = await import("@/integrations/supabase/client.server");
    // Recálculo set-based em uma única chamada SQL — O(N) no banco em vez de
    // milhares de round-trips HTTP. Escala linearmente, não importa quantos
    // jogos já estejam finalizados.
    const { data, error } = await supabase.rpc("recalculate_all_scores");
    if (error) throw error;
    return (data as { ok: boolean; profiles: number }) ?? { ok: true, profiles: 0 };
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