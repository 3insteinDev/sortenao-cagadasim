import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { submitAllPredictions } from "@/lib/api/predictions.functions";
import { Flag } from "@/components/app/Flag";
import { PHASE_LABEL, PHASE_ORDER, type Phase } from "@/lib/db/types";
import { toast } from "sonner";
import { Lock, Clock, CheckCircle2, Dices } from "lucide-react";

export const Route = createFileRoute("/_authenticated/palpites")({ component: PalpitesPage });

type MatchRow = any;
type Team = { id: string; name: string; sigla: string; flag: string; group_letter: string | null };

function PalpitesPage() {
  const navigate = useNavigate();
  const submit = useServerFn(submitAllPredictions);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [randomOpen, setRandomOpen] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [existing, setExisting] = useState<Record<string, { h: number; a: number }>>({});
  const [scores, setScores] = useState<Record<string, { h: string; a: string }>>({});
  const [tp, setTp] = useState<Record<string, string>>({});
  const [existingTp, setExistingTp] = useState<Record<string, string>>({});
  const [phaseFilter, setPhaseFilter] = useState<Phase | "all">("group");

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const uid = u.user.id;
      const [prof, t, m, p, t2] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", uid).single(),
        supabase.from("teams").select("*").order("group_letter").order("name"),
        supabase.from("matches").select("*, home:home_team_id(id,name,sigla,flag), away:away_team_id(id,name,sigla,flag)").order("kickoff_at"),
        supabase.from("predictions").select("match_id,home_score,away_score").eq("user_id", uid),
        supabase.from("tournament_predictions").select("pred_type,group_letter,team_id").eq("user_id", uid),
      ]);
      setProfile(prof.data);
      setTeams(t.data ?? []);
      setMatches(m.data ?? []);
      const ex: any = {};
      (p.data ?? []).forEach((r: any) => { ex[r.match_id] = { h: r.home_score, a: r.away_score }; });
      setExisting(ex);
      const etp: any = {};
      (t2.data ?? []).forEach((r: any) => { etp[`${r.pred_type}|${r.group_letter ?? ""}`] = r.team_id; });
      setExistingTp(etp);
      setLoading(false);
    })();
  }, []);

  // Global lock removed — predictions are editable per match until kickoff.
  // Tournament classification picks lock once the first match has started.
  const tournamentLocked = useMemo(
    () => matches.some((m: any) => new Date(m.kickoff_at) <= new Date() || m.status !== "scheduled"),
    [matches],
  );

  const byPhase = useMemo(() => {
    const groups: Record<Phase, MatchRow[]> = { group:[], r32:[], r16:[], qf:[], sf:[], third:[], final:[] };
    for (const m of matches) groups[m.phase as Phase].push(m);
    return groups;
  }, [matches]);

  const visibleMatches = phaseFilter === "all" ? matches : byPhase[phaseFilter];

  const totalEditable = matches.filter((m) => m.status === "scheduled" && new Date(m.kickoff_at) > new Date()).length;
  const filledCount = matches.filter((m) => {
    const s = scores[m.id];
    const ex = existing[m.id];
    if (s && s.h !== "" && s.a !== "") return true;
    return !!ex;
  }).length;

  function setScore(id: string, side: "h" | "a", v: string) {
    setScores((s) => ({ ...s, [id]: { h: s[id]?.h ?? "", a: s[id]?.a ?? "", [side]: v.replace(/\D/g, "").slice(0, 2) } as any }));
  }

  function fillRandom() {
    const next = { ...scores };
    for (const m of matches) {
      const started = new Date(m.kickoff_at) <= new Date() || m.status !== "scheduled";
      if (started) continue;
      const cur = next[m.id] ?? { h: "", a: "" };
      const ex = existing[m.id];
      if ((cur.h !== "" && cur.a !== "") || ex) continue;
      next[m.id] = { h: String(Math.floor(Math.random() * 5)), a: String(Math.floor(Math.random() * 5)) };
    }
    setScores(next);
    setRandomOpen(false);
    toast.success("Palpites aleatórios preenchidos. Revise antes de enviar!");
  }

  async function doSubmit() {
    setSubmitting(true);
    try {
      const m = Object.entries(scores)
        .filter(([, v]) => v.h !== "" && v.a !== "")
        .map(([id, v]) => ({ match_id: id, home_score: parseInt(v.h, 10), away_score: parseInt(v.a, 10) }));
      const tournament = Object.entries(tp).filter(([, v]) => !!v).map(([key, team_id]) => {
        const [pred_type, group_letter] = key.split("|");
        return { pred_type: pred_type as any, group_letter: group_letter || null, team_id };
      });
      await submit({ data: { matches: m, tournament } });
      toast.success("Palpites enviados!");
      navigate({ to: "/dashboard" });
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao enviar");
    } finally {
      setSubmitting(false);
      setConfirmOpen(false);
    }
  }

  if (loading) return <div className="p-8 text-center text-slate-500 uppercase tracking-widest">Carregando...</div>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 pb-32 space-y-6">
      <div>
        <h1 className="font-display text-5xl uppercase italic mb-2">Meus Palpites</h1>
        <p className="text-slate-500 text-sm uppercase tracking-widest">Preencha todos os jogos que desejar antes de enviar</p>
      </div>

      <div className="bg-white/5 border border-white/10 p-4">
          <div className="flex justify-between text-xs uppercase tracking-widest text-slate-400 mb-2">
            <span>Progresso</span>
            <span>{filledCount} de {totalEditable} jogos preenchidos ({totalEditable ? Math.round((filledCount/totalEditable)*100) : 0}%)</span>
          </div>
          <div className="h-2 bg-white/10 rounded overflow-hidden">
            <div className="h-full bg-grass transition-all" style={{ width: `${totalEditable ? (filledCount/totalEditable)*100 : 0}%` }} />
          </div>
      </div>
      <div className="text-xs text-slate-400">
        Você pode editar cada palpite até o início da partida. Após o início, o jogo é bloqueado automaticamente.
      </div>

      <button
        type="button"
        onClick={() => setRandomOpen(true)}
        className="w-full md:w-auto inline-flex items-center justify-center gap-2 bg-gold/20 border border-gold text-gold font-black uppercase py-3 px-5 tracking-tighter hover:bg-gold hover:text-night transition-colors"
      >
        <Dices className="size-5" /> 🎲 Preencher Aleatório
      </button>

      {/* phase filter */}
      <div className="flex flex-wrap gap-2">
        {(["all", ...PHASE_ORDER] as const).map((ph) => (
          <button key={ph} onClick={() => setPhaseFilter(ph)}
            className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest border ${phaseFilter===ph?"bg-grass text-night border-grass":"border-white/10 text-slate-400 hover:text-white"}`}>
            {ph === "all" ? "Todos" : PHASE_LABEL[ph as Phase]}
          </button>
        ))}
      </div>

      {/* Matches list */}
      <div className="space-y-2">
        {visibleMatches.map((m) => {
          const hasResult = m.status === "finished" && m.home_score != null;
          const started = new Date(m.kickoff_at) <= new Date() || hasResult;
          const exists = existing[m.id];
          const disabled = started;
          const s = scores[m.id] ?? { h: exists?.h?.toString() ?? "", a: exists?.a?.toString() ?? "" };
          const status = hasResult ? "result" : started ? "started" : exists ? "submitted" : "open";
          const StatusIcon = status === "result" ? CheckCircle2 : status === "started" ? Lock : status === "submitted" ? CheckCircle2 : Clock;
          const statusLabel = status === "result" ? "Oficial" : status === "started" ? "Iniciado" : status === "submitted" ? "Editável" : "Aberto";
          const statusColor = status === "result" ? "text-grass" : status === "started" ? "text-victory" : status === "submitted" ? "text-gold" : "text-slate-500";
          return (
            <div key={m.id} className={`bg-white/5 border border-white/10 p-4 ${disabled?"opacity-70":""}`}>
              <div className="flex justify-between items-center mb-3 text-[10px] uppercase tracking-widest text-slate-500">
                <span>
                  {PHASE_LABEL[m.phase as Phase]}{m.group_letter ? ` · Grupo ${m.group_letter}` : ""}{m.round ? ` · Rodada ${m.round}` : ""}
                  {m.kickoff_at ? ` · ${new Date(m.kickoff_at).toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}` : ""}
                </span>
                <span className={`flex items-center gap-1 ${statusColor}`}>
                  {StatusIcon && <StatusIcon className="size-3" />}{statusLabel}
                </span>
              </div>
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                <div className="flex items-center gap-2 justify-end">
                  <Flag showName flag={m.home?.flag} name={m.home?.name ?? m.home_placeholder} sigla={m.home?.sigla ?? m.home_placeholder} />
                </div>
                <div className="flex items-center gap-1">
                  <input value={s.h} onChange={(e) => setScore(m.id,"h",e.target.value)} disabled={disabled} inputMode="numeric" className="w-12 text-center bg-night border border-white/10 py-2 font-display text-2xl disabled:opacity-60" />
                  <span className="font-display text-xl text-slate-500">×</span>
                  <input value={s.a} onChange={(e) => setScore(m.id,"a",e.target.value)} disabled={disabled} inputMode="numeric" className="w-12 text-center bg-night border border-white/10 py-2 font-display text-2xl disabled:opacity-60" />
                </div>
                <div className="flex items-center gap-2">
                  <Flag showName flag={m.away?.flag} name={m.away?.name ?? m.away_placeholder} sigla={m.away?.sigla ?? m.away_placeholder} />
                </div>
              </div>
              {hasResult && (
                <div className="mt-2 text-center text-xs text-slate-400">Resultado oficial: {m.home_score} × {m.away_score}</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Tournament predictions */}
      {(phaseFilter === "all" || phaseFilter === "group") && (
        <TournamentSection teams={teams} value={tp} existing={existingTp} locked={tournamentLocked} onChange={(k, v) => setTp((s) => ({ ...s, [k]: v }))} />
      )}

      <button onClick={() => setConfirmOpen(true)} disabled={submitting}
        className="fixed bottom-4 left-4 right-4 md:static md:w-full bg-grass text-night font-black uppercase py-4 text-lg tracking-tighter disabled:opacity-50 z-30">
        Salvar Palpites
      </button>

      {confirmOpen && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-night border border-white/10 max-w-md w-full p-6 space-y-4">
            <h3 className="font-display text-3xl uppercase italic">Salvar Palpites</h3>
            <p className="text-slate-400 text-sm">Seus palpites serão salvos. Você poderá <b className="text-white">editar cada jogo</b> até o seu início. Deseja continuar?</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmOpen(false)} className="flex-1 border border-white/20 py-3 font-bold uppercase tracking-widest text-xs">Cancelar</button>
              <button onClick={doSubmit} disabled={submitting} className="flex-1 bg-grass text-night py-3 font-black uppercase tracking-tighter disabled:opacity-50">{submitting?"Salvando...":"Confirmar"}</button>
            </div>
          </div>
        </div>
      )}

      {randomOpen && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-night border border-white/10 max-w-md w-full p-6 space-y-4">
            <h3 className="font-display text-3xl uppercase italic">Preencher Aleatório</h3>
            <p className="text-slate-400 text-sm">
              Deseja preencher todos os palpites <b className="text-white">ainda em aberto</b> com resultados aleatórios (0 a 4 gols)? Os palpites já enviados não serão alterados. Você ainda poderá editar manualmente antes de enviar.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setRandomOpen(false)} className="flex-1 border border-white/20 py-3 font-bold uppercase tracking-widest text-xs">Cancelar</button>
              <button onClick={fillRandom} className="flex-1 bg-gold text-night py-3 font-black uppercase tracking-tighter">Preencher</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TournamentSection({ teams, value, existing, locked, onChange }: { teams: Team[]; value: Record<string,string>; existing: Record<string,string>; locked: boolean; onChange: (k:string,v:string)=>void }) {
  const groups = Array.from(new Set(teams.map((t) => t.group_letter).filter(Boolean))) as string[];
  function Select({ k }: { k: string }) {
    const v = value[k] ?? existing[k] ?? "";
    return (
      <select value={v} disabled={locked} onChange={(e) => onChange(k, e.target.value)} className="bg-white/5 border border-white/10 px-2 py-2 text-sm w-full disabled:opacity-60">
        <option value="">—</option>
        {teams.map((t) => <option key={t.id} value={t.id}>{t.flag} {t.name}</option>)}
      </select>
    );
  }
  return (
    <div className="space-y-6 border-t border-white/10 pt-6">
      <h2 className="font-display text-3xl uppercase italic">Palpites de Classificação</h2>
      {locked && (
        <div className="bg-victory/10 border border-victory/30 p-3 text-xs text-slate-300 flex items-center gap-2">
          <Lock className="size-4 text-victory" /> Palpites de classificação bloqueados (torneio iniciado).
        </div>
      )}

      <div>
        <h3 className="text-xs uppercase tracking-widest text-slate-500 mb-3">Classificados dos Grupos</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {groups.map((g) => (
            <div key={g} className="bg-white/5 border border-white/10 p-3">
              <div className="font-display text-xl mb-2">Grupo {g}</div>
              <label className="text-[10px] uppercase tracking-widest text-slate-500">1º colocado</label>
              <Select k={`group_1st|${g}`} />
              <label className="text-[10px] uppercase tracking-widest text-slate-500 mt-2 block">2º colocado</label>
              <Select k={`group_2nd|${g}`} />
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {[["champion","Campeão","🏆"],["runner_up","Vice-campeão","🥈"],["third","Terceiro lugar","🥉"]].map(([k,l,e]) => (
          <div key={k} className="bg-white/5 border border-white/10 p-3">
            <div className="font-display text-xl mb-2">{e} {l}</div>
            <Select k={`${k}|`} />
          </div>
        ))}
      </div>
    </div>
  );
}