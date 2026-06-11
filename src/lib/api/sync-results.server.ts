import { supabaseAdmin } from "@/integrations/supabase/client.server";

type FDMatch = {
  id: number;
  utcDate: string;
  status: string;
  homeTeam: { tla: string | null; name: string };
  awayTeam: { tla: string | null; name: string };
  score: { fullTime: { home: number | null; away: number | null } };
};

async function fetchFinishedMatches(apiKey: string): Promise<FDMatch[]> {
  const res = await fetch("https://api.football-data.org/v4/competitions/WC/matches?status=FINISHED", {
    headers: { "X-Auth-Token": apiKey },
  });
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
    .select("id,external_id,kickoff_at,manual_override,status,home:home_team_id(sigla),away:away_team_id(sigla)");
  if (readErr) throw readErr;

  let updated = 0;
  const nowIso = new Date().toISOString();

  for (const r of remote) {
    const home = r.score.fullTime.home;
    const away = r.score.fullTime.away;
    if (home == null || away == null) continue;

    let target = (localMatches ?? []).find((m: any) => m.external_id === r.id) as any;
    if (!target) {
      const remoteDay = r.utcDate.slice(0, 10);
      target = (localMatches ?? []).find((m: any) => {
        if (!m.home?.sigla || !m.away?.sigla || !r.homeTeam.tla || !r.awayTeam.tla) return false;
        if (m.home.sigla.toUpperCase() !== r.homeTeam.tla.toUpperCase()) return false;
        if (m.away.sigla.toUpperCase() !== r.awayTeam.tla.toUpperCase()) return false;
        return (m.kickoff_at as string).slice(0, 10) === remoteDay;
      });
    }
    if (!target) continue;
    if (target.manual_override) continue;

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
    if (!error) updated++;
  }

  return { updated, fetched: remote.length };
}