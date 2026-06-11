import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Flag } from "@/components/app/Flag";
import { PHASE_LABEL } from "@/lib/db/types";
import { Trophy, Target, TrendingUp, Award } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({ component: Dashboard });

function Dashboard() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const uid = u.user.id;
      const [profile, achievements, upcoming, lastResults, ranking] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", uid).single(),
        supabase.from("achievements").select("*").eq("user_id", uid),
        supabase.from("matches").select("*, home:home_team_id(name,sigla,flag), away:away_team_id(name,sigla,flag)").gt("kickoff_at", new Date().toISOString()).order("kickoff_at").limit(5),
        supabase.from("predictions").select("points,match:match_id(home_score,away_score,phase,home:home_team_id(sigla,flag),away:away_team_id(sigla,flag))").eq("user_id", uid).order("submitted_at", { ascending: false }).limit(5),
        supabase.rpc("get_leaderboard"),
      ]);
      const rank = (ranking.data ?? []).findIndex((p: any) => p.id === uid) + 1;
      setData({ profile: profile.data, achievements: achievements.data ?? [], upcoming: upcoming.data ?? [], lastResults: lastResults.data ?? [], rank });
    })();
  }, []);

  if (!data) return <div className="p-8 text-center text-slate-500 uppercase tracking-widest">Carregando...</div>;

  const p = data.profile;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      <div>
        <p className="text-slate-500 text-xs uppercase tracking-widest">Bem-vindo de volta,</p>
        <h1 className="font-display text-5xl uppercase italic tracking-tighter">{p.nickname}</h1>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat icon={<Trophy className="size-4 text-gold" />} label="Posição" value={`${data.rank || "—"}º`} />
        <Stat icon={<Target className="size-4 text-grass" />} label="Pontos" value={p.total_points} />
        <Stat icon={<TrendingUp className="size-4 text-grass" />} label="Acertos" value={p.total_hits} />
        <Stat icon={<Award className="size-4 text-gold" />} label="Conquistas" value={data.achievements.length} />
      </div>

      {!p.predictions_submitted_at && (
        <Link to="/palpites" className="block bg-grass text-night p-6 font-black uppercase tracking-tighter text-center text-lg hover:brightness-110">
          Você ainda não enviou seus palpites! Clique aqui &rarr;
        </Link>
      )}

      <Section title="Próximos Jogos">
        {data.upcoming.length === 0 ? <Empty>Nenhum jogo agendado</Empty> : data.upcoming.map((m: any) => (
          <div key={m.id} className="bg-white/5 border-l-4 border-grass p-4 flex items-center justify-between">
            <div className="flex items-center gap-3 text-sm">
              <Flag flag={m.home?.flag} sigla={m.home?.sigla ?? m.home_placeholder} />
              <span className="text-slate-500 font-display text-xl">VS</span>
              <Flag flag={m.away?.flag} sigla={m.away?.sigla ?? m.away_placeholder} />
            </div>
            <span className="text-[10px] uppercase tracking-widest text-slate-500">{new Date(m.kickoff_at).toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}</span>
          </div>
        ))}
      </Section>

      <Section title="Últimos Resultados">
        {data.lastResults.length === 0 ? <Empty>Sem resultados ainda</Empty> : data.lastResults.map((r: any, i: number) => (
          <div key={i} className="bg-white/5 p-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <Flag flag={r.match?.home?.flag} sigla={r.match?.home?.sigla} />
              <span className="font-display text-xl">{r.match?.home_score ?? "-"} : {r.match?.away_score ?? "-"}</span>
              <Flag flag={r.match?.away?.flag} sigla={r.match?.away?.sigla} />
            </div>
            <span className={`font-display text-xl ${r.points > 0 ? "text-grass" : "text-slate-600"}`}>+{r.points}</span>
          </div>
        ))}
      </Section>

      <Section title="Conquistas">
        {data.achievements.length === 0 ? <Empty>Conquiste sua primeira medalha!</Empty> : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {data.achievements.map((a: any) => (
              <div key={a.id} className="bg-white/5 border border-gold/30 p-4 text-center">
                <div className="text-3xl mb-1">{a.icon ?? "🏅"}</div>
                <div className="text-xs font-bold uppercase tracking-tight">{a.title}</div>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

function Stat({ icon, label, value }: any) {
  return (
    <div className="bg-white/5 border border-white/10 p-4">
      <div className="flex items-center gap-2 mb-2">{icon}<span className="text-[10px] uppercase tracking-widest text-slate-500">{label}</span></div>
      <div className="font-display text-3xl">{value}</div>
    </div>
  );
}
function Section({ title, children }: any) {
  return (<div><h2 className="font-display text-2xl uppercase italic mb-3">{title}</h2><div className="space-y-2">{children}</div></div>);
}
function Empty({ children }: any) { return <p className="text-slate-500 text-sm uppercase tracking-widest text-center py-6">{children}</p>; }

// re-export PHASE_LABEL touched to avoid unused warning
void PHASE_LABEL;