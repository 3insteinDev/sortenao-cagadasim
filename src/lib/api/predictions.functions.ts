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
    "fourth_place",
  ]),
  group_letter: z.string().nullable().optional(),
  team_id: z.string().uuid(),
});
const submitSchema = z.object({
  matches: z.array(matchPredSchema),
  tournament: z.array(tpSchema),
});

const matchParticipantsSchema = z.object({ match_id: z.string().uuid() });

// Tournament classification predictions (group winners, champion, etc.) are
// allowed until 2026-06-18 13:00 BRT (UTC-3) — i.e. 16:00 UTC.
export const TOURNAMENT_PREDICTIONS_DEADLINE = "2026-06-18T16:00:00Z";

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
  if (predictedOutcome === currentOutcome && currentOutcome !== 0) {
    return oneScoreIsExact ? 11 : 8;
  }
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
    const hasStarted =
      match.status === "finished" ||
      match.status === "live" ||
      (match.status === "scheduled" && new Date(match.kickoff_at) <= new Date());
    if (!hasStarted) {
      throw new Error("Os palpites são revelados somente após o início do jogo.");
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
      const calculatedPoints =
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
        points: prediction?.points ?? calculatedPoints,
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

export const getFinishedMatchScores = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [
      { data: matches, error: matchesError },
      { data: participants, error: participantsError },
      { data: predictions, error: predictionsError },
    ] = await Promise.all([
      supabaseAdmin
        .from("matches")
        .select(
          "id,phase,kickoff_at,home_score,away_score,home_placeholder,away_placeholder,home:home_team_id(sigla),away:away_team_id(sigla)",
        )
        .eq("status", "finished")
        .order("kickoff_at", { ascending: false }),
      supabaseAdmin
        .from("leaderboard_entries")
        .select("id,nickname,total_points")
        .order("total_points", { ascending: false }),
      supabaseAdmin.from("predictions").select("user_id,match_id,home_score,away_score,points"),
    ]);
    if (matchesError) throw matchesError;
    if (participantsError) throw participantsError;
    if (predictionsError) throw predictionsError;

    const finishedMatches = (matches ?? []).map((match) => ({
      ...match,
      home: Array.isArray(match.home) ? (match.home[0] ?? null) : match.home,
      away: Array.isArray(match.away) ? (match.away[0] ?? null) : match.away,
    }));
    const finishedById = new Map(finishedMatches.map((match) => [match.id, match]));
    const scoresByUser = new Map<string, Record<string, { prediction: string; points: number }>>();

    for (const prediction of predictions ?? []) {
      const match = finishedById.get(prediction.match_id);
      if (!match || match.home_score == null || match.away_score == null) continue;
      const userScores = scoresByUser.get(prediction.user_id) ?? {};
      userScores[prediction.match_id] = {
        prediction: `${prediction.home_score} × ${prediction.away_score}`,
        points:
          prediction.points ??
          pointsForMatch(match.phase, prediction, {
            home_score: match.home_score,
            away_score: match.away_score,
          }),
      };
      scoresByUser.set(prediction.user_id, userScores);
    }

    return {
      matches: finishedMatches,
      participants: (participants ?? []).map((participant) => ({
        ...participant,
        is_current_user: participant.id === context.userId,
        scores: scoresByUser.get(participant.id) ?? {},
      })),
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

    // Tournament predictions: allowed until the configured deadline.
    const tournamentLocked = new Date(nowIso) >= new Date(TOURNAMENT_PREDICTIONS_DEADLINE);

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

const TP_POINTS: Record<string, number> = {
  group_1st: 5,
  group_2nd: 5,
  r16: 3,
  qf: 5,
  sf: 8,
  finalist: 12,
  champion: 30,
  runner_up: 15,
  third: 10,
  fourth_place: 10,
};

export const getTournamentPredictionsOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [
      { data: participants, error: pErr },
      { data: preds, error: tpErr },
      { data: results, error: rErr },
      { data: teams, error: teamErr },
    ] = await Promise.all([
      supabaseAdmin
        .from("leaderboard_entries")
        .select("id,nickname,total_points")
        .order("nickname"),
      supabaseAdmin
        .from("tournament_predictions")
        .select("user_id,pred_type,group_letter,team_id,points"),
      supabaseAdmin
        .from("tournament_results")
        .select("result_type,group_letter,team_id"),
      supabaseAdmin.from("teams").select("id,name,sigla,flag"),
    ]);
    if (pErr) throw pErr;
    if (tpErr) throw tpErr;
    if (rErr) throw rErr;
    if (teamErr) throw teamErr;

    const teamMap = new Map(
      (teams ?? []).map((t) => [t.id, t]),
    );
    const resultMap = new Map<string, string>();
    for (const r of results ?? []) {
      if (!r.team_id) continue;
      resultMap.set(`${r.result_type}|${r.group_letter ?? ""}`, r.team_id);
    }

    const slots: { key: string; pred_type: string; group_letter: string | null; label: string }[] = [];
    const groups = ["A","B","C","D","E","F","G","H","I","J","K","L"];
    for (const g of groups) {
      slots.push({ key: `group_1st|${g}`, pred_type: "group_1st", group_letter: g, label: `1º ${g}` });
      slots.push({ key: `group_2nd|${g}`, pred_type: "group_2nd", group_letter: g, label: `2º ${g}` });
    }
    slots.push({ key: "champion|", pred_type: "champion", group_letter: null, label: "Campeão" });
    slots.push({ key: "runner_up|", pred_type: "runner_up", group_letter: null, label: "Vice" });
    slots.push({ key: "third|", pred_type: "third", group_letter: null, label: "3º Lugar" });
    slots.push({ key: "fourth_place|", pred_type: "fourth_place", group_letter: null, label: "4º Lugar" });

    const predByUser = new Map<string, Map<string, { team_id: string | null; points: number }>>();
    for (const tp of preds ?? []) {
      const key = `${tp.pred_type}|${tp.group_letter ?? ""}`;
      let m = predByUser.get(tp.user_id);
      if (!m) {
        m = new Map();
        predByUser.set(tp.user_id, m);
      }
      m.set(key, { team_id: tp.team_id, points: tp.points ?? 0 });
    }

    const rows = (participants ?? []).map((p) => {
      const userPreds = predByUser.get(p.id);
      const cells: Record<string, { team: { name: string; sigla: string; flag: string } | null; points: number; correct: boolean }> = {};
      let totalClassPoints = 0;
      for (const slot of slots) {
        const pred = userPreds?.get(slot.key);
        const team = pred?.team_id ? teamMap.get(pred.team_id) ?? null : null;
        const officialTeamId = resultMap.get(slot.key);
        const correct = !!pred?.team_id && !!officialTeamId && pred.team_id === officialTeamId;
        const points = pred?.points ?? (correct ? (TP_POINTS[slot.pred_type] ?? 0) : 0);
        cells[slot.key] = {
          team: team
            ? { name: team.name, sigla: team.sigla, flag: team.flag }
            : null,
          points,
          correct,
        };
        totalClassPoints += points;
      }
      return {
        id: p.id,
        nickname: p.nickname,
        total_points: p.total_points,
        is_current_user: p.id === context.userId,
        cells,
        total_class_points: totalClassPoints,
      };
    });

    rows.sort((a, b) => b.total_class_points - a.total_class_points || a.nickname.localeCompare(b.nickname, "pt-BR"));
    return { slots, participants: rows };
  });
