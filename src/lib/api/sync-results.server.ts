import { supabaseAdmin } from "@/integrations/supabase/client.server";

type FDMatch = {
  id: number;
  utcDate: string;
  status: string;
  homeTeam: { tla: string | null; name: string };
  awayTeam: { tla: string | null; name: string };
  score: { fullTime: { home: number | null; away: number | null } };
};

type LocalMatch = {
  id: string;
  external_id: number | null;
  kickoff_at: string;
  manual_override: boolean;
  status: string;
  home_score: number | null;
  away_score: number | null;
  home: { sigla: string | null } | null;
  away: { sigla: string | null } | null;
};

const TEAM_CODE_ALIASES: Record<string, string> = {
  EUA: "USA",
};

function normalizedCode(code: string | null | undefined) {
  const value = code?.trim().toUpperCase();
  return value ? (TEAM_CODE_ALIASES[value] ?? value) : null;
}

async function fetchFinishedMatches(apiKey: string): Promise<FDMatch[]> {
  const res = await fetch(
    "https://api.football-data.org/v4/competitions/WC/matches?status=FINISHED",
    {
      headers: { "X-Auth-Token": apiKey },
    },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Football-Data API ${res.status}: ${body}`);
  }
  const json = (await res.json()) as { matches?: FDMatch[] };
  return json.matches ?? [];
}

export async function syncFootballDataResults() {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  if (!apiKey) throw new Error("FOOTBALL_DATA_API_KEY ausente.");

  const remote = await fetchFinishedMatches(apiKey);
  const { data: localMatches, error: readErr } = await supabaseAdmin
    .from("matches")
    .select(
      "id,external_id,kickoff_at,manual_override,status,home_score,away_score,home:home_team_id(sigla),away:away_team_id(sigla)",
    );
  if (readErr) throw readErr;
  const matches = (localMatches ?? []) as unknown as LocalMatch[];

  let updated = 0;
  let unchanged = 0;
  let skippedManual = 0;
  const unmatched: number[] = [];
  const nowIso = new Date().toISOString();

  for (const r of remote) {
    const home = r.score.fullTime.home;
    const away = r.score.fullTime.away;
    if (home == null || away == null) continue;

    let target = matches.find((match) => match.external_id === r.id);
    if (!target) {
      const remoteDay = r.utcDate.slice(0, 10);
      target = matches.find((m) => {
        const sameTeams =
          normalizedCode(m.home?.sigla) === normalizedCode(r.homeTeam.tla) &&
          normalizedCode(m.away?.sigla) === normalizedCode(r.awayTeam.tla);
        return sameTeams && (m.kickoff_at as string).slice(0, 10) === remoteDay;
      });
    }
    if (!target) {
      unmatched.push(r.id);
      continue;
    }
    if (target.manual_override) {
      skippedManual++;
      continue;
    }

    const resultChanged =
      target.external_id !== r.id ||
      target.home_score !== home ||
      target.away_score !== away ||
      target.status !== "finished";

    const { error } = await supabaseAdmin
      .from("matches")
      .update({
        external_id: r.id,
        home_score: home,
        away_score: away,
        status: "finished",
        last_synced_at: nowIso,
      })
      .eq("id", target.id);
    if (error) throw new Error(`Falha ao atualizar o jogo ${r.id}: ${error.message}`);
    if (resultChanged) updated++;
    else unchanged++;
  }

  return { updated, unchanged, skippedManual, unmatched, fetched: remote.length };
}
