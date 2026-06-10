import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const matchPredSchema = z.object({
  match_id: z.string().uuid(),
  home_score: z.number().int().min(0).max(50),
  away_score: z.number().int().min(0).max(50),
});
const tpSchema = z.object({
  pred_type: z.enum(["group_1st","group_2nd","r16","qf","sf","finalist","champion","runner_up","third"]),
  group_letter: z.string().nullable().optional(),
  team_id: z.string().uuid(),
});
const submitSchema = z.object({
  matches: z.array(matchPredSchema),
  tournament: z.array(tpSchema),
});

export const submitAllPredictions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => submitSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const nowIso = new Date().toISOString();

    // Check profile not already submitted
    const { data: prof } = await supabase.from("profiles").select("predictions_submitted_at").eq("id", userId).maybeSingle();
    if (prof?.predictions_submitted_at) {
      throw new Error("Você já enviou seus palpites. Não é possível alterar.");
    }

    // Filter matches not yet kicked off
    const matchIds = data.matches.map((m) => m.match_id);
    let validIds = new Set<string>(matchIds);
    if (matchIds.length) {
      const { data: openMatches } = await supabase
        .from("matches")
        .select("id,kickoff_at,status")
        .in("id", matchIds);
      validIds = new Set(
        (openMatches ?? [])
          .filter((m) => m.status === "scheduled" && new Date(m.kickoff_at) > new Date())
          .map((m) => m.id),
      );
    }

    const matchRows = data.matches
      .filter((m) => validIds.has(m.match_id))
      .map((m) => ({ user_id: userId, match_id: m.match_id, home_score: m.home_score, away_score: m.away_score, submitted_at: nowIso }));

    if (matchRows.length) {
      const { error } = await supabase.from("predictions").upsert(matchRows, { onConflict: "user_id,match_id" });
      if (error) throw error;
    }

    const tpRows = data.tournament.map((t) => ({
      user_id: userId,
      pred_type: t.pred_type,
      group_letter: t.group_letter ?? null,
      team_id: t.team_id,
      submitted_at: nowIso,
    }));
    if (tpRows.length) {
      const { error } = await supabase.from("tournament_predictions").upsert(tpRows, { onConflict: "user_id,pred_type,group_letter" });
      if (error) throw error;
    }

    await supabase.from("profiles").update({ predictions_submitted_at: nowIso }).eq("id", userId);

    // First-prediction achievement
    await supabase.from("achievements").upsert(
      { user_id: userId, code: "first_prediction", title: "Primeiro Palpite", icon: "🏅" },
      { onConflict: "user_id,code" },
    );

    return { ok: true, count: matchRows.length };
  });