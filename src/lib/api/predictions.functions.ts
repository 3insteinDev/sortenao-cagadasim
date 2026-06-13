import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const matchPredSchema = z.object({
  match_id: z.string().uuid(),
  home_score: z.number().int().min(0).max(50),
  away_score: z.number().int().min(0).max(50),
});
const tpSchema = z.object({
  pred_type: z.enum([
    "group_1st",
    "group_2nd",
    "r16",
    "qf",
    "sf",
    "finalist",
    "champion",
    "runner_up",
    "third",
  ]),
  group_letter: z.string().nullable().optional(),
  team_id: z.string().uuid(),
});
const submitSchema = z.object({
  matches: z.array(matchPredSchema),
  tournament: z.array(tpSchema),
});

const matchParticipantsSchema = z.object({ match_id: z.string().uuid() });

function pointsForMatch(
  phase: string,
  prediction: { home_score: number; away_score: number },
  result: { home_score: number; away_score: number },
) {
  if (prediction.home_score === result.home_score && prediction.away_score === result.away_score) {
    return phase === "group" ? 10 : 15;
  }
  const predictedOutcome = Math.sign(prediction.home_score - prediction.away_score);
  const currentOutcome = Math.sign(result.home_score - result.away_score);
  const oneScoreIsExact =
    prediction.home_score === result.home_score || prediction.away_score === result.away_score;

  if (phase === "group") {
    if (predictedOutcome === currentOutcome) return oneScoreIsExact ? 7 : 5;
    return oneScoreIsExact ? 2 : 0;
  }
  if (predictedOutcome === currentOutcome && currentOutcome !== 0) return 8;
  return oneScoreIsExact ? 3 : 0;
}

export const getMatchParticipantPredictions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => matchParticipantsSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: match, error: matchError } = await supabaseAdmin
      .from("matches")
      .select(
        "id,phase,status,kickoff_at,home_score,away_score,home_placeholder,away_placeholder,home:home_team_id(name,sigla,flag),away:away_team_id(name,sigla,flag)",
      )
      .eq("id", data.match_id)
      .single();

    if (matchError || !match) throw new Error("Jogo não encontrado.");
    if (new Date(match.kickoff_at) > new Date() && match.status === "scheduled") {
      throw new Error("Os palpites serão revelados somente após o início do jogo.");
    }

    const [
      { data: participants, error: participantsError },
      { data: predictions, error: predictionsError },
    ] = await Promise.all([
      supabaseAdmin.from("leaderboard_entries").select("id,nickname,avatar_url").order("nickname"),
      supabaseAdmin
        .from("predictions")
        .select("user_id,home_score,away_score,points")
        .eq("match_id", data.match_id),
    ]);
    if (participantsError) throw participantsError;
    if (predictionsError) throw predictionsError;

    const predictionByUser = new Map(
      (predictions ?? []).map((prediction) => [prediction.user_id, prediction]),
    );
    const hasCurrentScore = match.home_score != null && match.away_score != null;
    const rows = (participants ?? []).map((participant) => {
      const prediction = predictionByUser.get(participant.id);
      const livePoints =
        prediction && hasCurrentScore
          ? pointsForMatch(match.phase, prediction, {
              home_score: match.home_score ?? 0,
              away_score: match.away_score ?? 0,
            })
          : 0;
      return {
        id: participant.id,
        nickname: participant.nickname,
        avatar_url: participant.avatar_url,
        prediction: prediction
          ? { home_score: prediction.home_score, away_score: prediction.away_score }
          : null,
        points: match.status === "finished" ? (prediction?.points ?? livePoints) : livePoints,
        is_current_user: participant.id === context.userId,
      };
    });

    rows.sort((a, b) => b.points - a.points || a.nickname.localeCompare(b.nickname, "pt-BR"));
    return {
      match: {
        ...match,
        home: Array.isArray(match.home) ? (match.home[0] ?? null) : match.home,
        away: Array.isArray(match.away) ? (match.away[0] ?? null) : match.away,
      },
      participants: rows,
    };
  });

export const submitAllPredictions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => submitSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const nowIso = new Date().toISOString();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

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
      .map((m) => ({
        user_id: userId,
        match_id: m.match_id,
        home_score: m.home_score,
        away_score: m.away_score,
        submitted_at: nowIso,
      }));

    if (matchRows.length) {
      const { error } = await supabaseAdmin
        .from("predictions")
        .upsert(matchRows, { onConflict: "user_id,match_id" });
      if (error) throw error;
    }

    // Tournament predictions: only allowed while no match has started yet
    const { data: firstStarted } = await supabase
      .from("matches")
      .select("id")
      .lte("kickoff_at", nowIso)
      .limit(1);
    const tournamentLocked = (firstStarted ?? []).length > 0;

    const tpRows = tournamentLocked
      ? []
      : data.tournament.map((t) => ({
          user_id: userId,
          pred_type: t.pred_type,
          group_letter: t.group_letter ?? null,
          team_id: t.team_id,
          submitted_at: nowIso,
        }));
    if (tpRows.length) {
      const { error } = await supabaseAdmin
        .from("tournament_predictions")
        .upsert(tpRows, { onConflict: "user_id,pred_type,group_letter" });
      if (error) throw error;
    }

    // System-managed fields must never be writable directly from the browser.
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({ predictions_submitted_at: nowIso })
      .eq("id", userId)
      .is("predictions_submitted_at", null);
    if (profileError) throw profileError;

    // First-prediction achievement
    const { error: achievementError } = await supabaseAdmin
      .from("achievements")
      .upsert(
        { user_id: userId, code: "first_prediction", title: "Primeiro Palpite", icon: "🏅" },
        { onConflict: "user_id,code" },
      );
    if (achievementError) throw achievementError;

    return { ok: true, count: matchRows.length };
  });
