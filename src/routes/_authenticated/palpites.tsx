import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import {
  submitAllPredictions,
  TOURNAMENT_PREDICTIONS_DEADLINE,
} from "@/lib/api/predictions.functions";
import { Flag } from "@/components/app/Flag";
import { MatchParticipantPredictions } from "@/components/app/MatchParticipantPredictions";
import { PHASE_LABEL, PHASE_ORDER, type Phase } from "@/lib/db/types";
import { toast } from "sonner";
import { Lock, Clock, CheckCircle2, Dices, Save, ChevronsUpDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BracketClassificados } from "@/components/app/BracketClassificados";

export const Route = createFileRoute("/_authenticated/palpites")({ component: PalpitesPage });

type MatchRow = any;
type Team = { id: string; name: string; sigla: string; flag: string; group_letter: string | null };

function PalpitesPage() {
  const navigate = useNavigate();
  const submit = useServerFn(submitAllPredictions);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [savingMatchId, setSavingMatchId] = useState<string | null>(null);
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
        supabase
          .from("matches")
          .select("*, home:home_team_id(id,name,sigla,flag), away:away_team_id(id,name,sigla,flag)")
          .order("kickoff_at"),
        supabase.from("predictions").select("match_id,home_score,away_score").eq("user_id", uid),
        supabase
          .from("tournament_predictions")
          .select("pred_type,group_letter,team_id")
          .eq("user_id", uid),
      ]);
      setProfile(prof.data);
      setTeams(t.data ?? []);
      setMatches(m.data ?? []);
      const ex: any = {};
      (p.data ?? []).forEach((r: any) => {
        ex[r.match_id] = { h: r.home_score, a: r.away_score };
      });
      setExisting(ex);
      const etp: any = {};
      (t2.data ?? []).forEach((r: any) => {
        etp[`${r.pred_type}|${r.group_letter ?? ""}`] = r.team_id;
      });
      setExistingTp(etp);
      setLoading(false);
    })();
  }, []);

  // Global lock removed — predictions are editable per match until kickoff.
  // Tournament classification picks lock at the configured deadline
  // (18/06/2026 às 13:00 BRT).
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  const tournamentDeadline = useMemo(() => new Date(TOURNAMENT_PREDICTIONS_DEADLINE), []);
  const tournamentLocked = now >= tournamentDeadline;

  const byPhase = useMemo(() => {
    const groups: Record<Phase, MatchRow[]> = {
      group: [],
      r32: [],
      r16: [],
      qf: [],
      sf: [],
      third: [],
      final: [],
    };
    for (const m of matches) groups[m.phase as Phase].push(m);
    return groups;
  }, [matches]);

  const visibleMatches = phaseFilter === "all" ? matches : byPhase[phaseFilter];

  const totalEditable = matches.filter(
    (m) => m.status === "scheduled" && new Date(m.kickoff_at) > new Date(),
  ).length;
  const filledCount = matches.filter((m) => {
    const s = scores[m.id];
    const ex = existing[m.id];
    if (s && s.h !== "" && s.a !== "") return true;
    return !!ex;
  }).length;

  function setScore(id: string, side: "h" | "a", v: string) {
    setScores((s) => ({
      ...s,
      [id]: {
        h: s[id]?.h ?? "",
        a: s[id]?.a ?? "",
        [side]: v.replace(/\D/g, "").slice(0, 2),
      } as any,
    }));
  }

  function fillRandom() {
    const next = { ...scores };
    for (const m of matches) {
      const started = new Date(m.kickoff_at) <= new Date() || m.status !== "scheduled";
      if (started) continue;
      const cur = next[m.id] ?? { h: "", a: "" };
      const ex = existing[m.id];
      if ((cur.h !== "" && cur.a !== "") || ex) continue;
      next[m.id] = {
        h: String(Math.floor(Math.random() * 5)),
        a: String(Math.floor(Math.random() * 5)),
      };
    }
    setScores(next);
    setRandomOpen(false);
    toast.success("Palpites aleatórios preenchidos. Revise antes de enviar!");
  }

  async function saveMatch(matchId: string) {
    const score = scores[matchId];
    if (!score || score.h === "" || score.a === "") return;
    setSavingMatchId(matchId);
    try {
      await submit({
        data: {
          matches: [
            {
              match_id: matchId,
              home_score: parseInt(score.h, 10),
              away_score: parseInt(score.a, 10),
            },
          ],
          tournament: [],
        },
      });
      setExisting((current) => ({
        ...current,
        [matchId]: { h: parseInt(score.h, 10), a: parseInt(score.a, 10) },
      }));
      setScores((current) => {
        const next = { ...current };
        delete next[matchId];
        return next;
      });
      toast.success("Palpite salvo!");
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Erro ao salvar o palpite");
    } finally {
      setSavingMatchId(null);
    }
  }

  async function doSubmit() {
    setSubmitting(true);
    try {
      const m = Object.entries(scores)
        .filter(([, v]) => v.h !== "" && v.a !== "")
        .map(([id, v]) => ({
          match_id: id,
          home_score: parseInt(v.h, 10),
          away_score: parseInt(v.a, 10),
        }));
      const tournament = Object.entries(tp)
        .filter(([, v]) => !!v)
        .map(([key, team_id]) => {
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

  if (loading)
    return (
      <div className="p-8 text-center text-slate-500 uppercase tracking-widest">Carregando...</div>
    );

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8 pb-32 space-y-6">
      <div>
        <h1 className="font-display text-3xl sm:text-5xl uppercase italic mb-2">Meus Palpites</h1>
        <p className="text-slate-500 text-xs sm:text-sm uppercase tracking-widest">
          Preencha todos os jogos que desejar antes de enviar
        </p>
      </div>

      <Tabs defaultValue="jogos" className="w-full">
        <TabsList className="w-full grid grid-cols-2 bg-white/5 border border-white/10 h-auto p-1 rounded-none">
          <TabsTrigger
            value="jogos"
            className="rounded-none data-[state=active]:bg-grass data-[state=active]:text-night uppercase tracking-widest text-xs font-bold py-2"
          >
            Jogos
          </TabsTrigger>
          <TabsTrigger
            value="classificados"
            className="rounded-none data-[state=active]:bg-grass data-[state=active]:text-night uppercase tracking-widest text-xs font-bold py-2"
          >
            Classificados
          </TabsTrigger>
        </TabsList>

        <TabsContent value="jogos" className="space-y-6 mt-6">
      <div className="bg-white/5 border border-white/10 p-4">
        <div className="flex flex-wrap justify-between gap-x-2 gap-y-1 text-[10px] sm:text-xs uppercase tracking-widest text-slate-400 mb-2">
          <span>Progresso</span>
          <span>
            {filledCount} de {totalEditable} jogos preenchidos (
            {totalEditable ? Math.round((filledCount / totalEditable) * 100) : 0}%)
          </span>
        </div>
        <div className="h-2 bg-white/10 rounded overflow-hidden">
          <div
            className="h-full bg-grass transition-all"
            style={{ width: `${totalEditable ? (filledCount / totalEditable) * 100 : 0}%` }}
          />
        </div>
      </div>
      <div className="text-xs text-slate-400">
        Você pode editar cada palpite até o início da partida. Após o início, o jogo é bloqueado
        automaticamente.
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
          <button
            key={ph}
            onClick={() => setPhaseFilter(ph)}
            className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest border ${phaseFilter === ph ? "bg-grass text-night border-grass" : "border-white/10 text-slate-400 hover:text-white"}`}
          >
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
          const s = scores[m.id] ?? {
            h: exists?.h?.toString() ?? "",
            a: exists?.a?.toString() ?? "",
          };
          const status = hasResult ? "result" : started ? "started" : exists ? "submitted" : "open";
          const StatusIcon =
            status === "result"
              ? CheckCircle2
              : status === "started"
                ? Lock
                : status === "submitted"
                  ? CheckCircle2
                  : Clock;
          const statusLabel =
            status === "result"
              ? "Oficial"
              : status === "started"
                ? "Iniciado"
                : status === "submitted"
                  ? "Editável"
                  : "Aberto";
          const statusColor =
            status === "result"
              ? "text-grass"
              : status === "started"
                ? "text-victory"
                : status === "submitted"
                  ? "text-gold"
                  : "text-slate-500";
          const changed =
            !disabled &&
            s.h !== "" &&
            s.a !== "" &&
            (Number(s.h) !== exists?.h || Number(s.a) !== exists?.a);
          return (
            <div
              key={m.id}
              className={`bg-white/5 border border-white/10 p-3 sm:p-4 ${disabled ? "opacity-70" : ""}`}
            >
              <div className="flex flex-wrap justify-between items-center gap-x-2 gap-y-1 mb-3 text-[10px] uppercase tracking-widest text-slate-500">
                <span className="min-w-0">
                  {PHASE_LABEL[m.phase as Phase]}
                  {m.group_letter ? ` · Grupo ${m.group_letter}` : ""}
                  {m.round ? ` · Rodada ${m.round}` : ""}
                  {m.kickoff_at
                    ? ` · ${new Date(m.kickoff_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}`
                    : ""}
                </span>
                <span className={`flex shrink-0 items-center gap-1 ${statusColor}`}>
                  {StatusIcon && <StatusIcon className="size-3" />}
                  {statusLabel}
                </span>
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-3">
                <div className="flex min-w-0 items-center gap-2 justify-end">
                  <Flag
                    showName
                    flag={m.home?.flag}
                    name={m.home?.name ?? m.home_placeholder}
                    sigla={m.home?.sigla ?? m.home_placeholder}
                  />
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <input
                    value={s.h}
                    onChange={(e) => setScore(m.id, "h", e.target.value)}
                    disabled={disabled}
                    inputMode="numeric"
                    className="w-10 sm:w-12 text-center bg-night border border-white/10 py-2 font-display text-xl sm:text-2xl disabled:opacity-60"
                  />
                  <span className="font-display text-lg sm:text-xl text-slate-500">×</span>
                  <input
                    value={s.a}
                    onChange={(e) => setScore(m.id, "a", e.target.value)}
                    disabled={disabled}
                    inputMode="numeric"
                    className="w-10 sm:w-12 text-center bg-night border border-white/10 py-2 font-display text-xl sm:text-2xl disabled:opacity-60"
                  />
                </div>
                <div className="flex min-w-0 items-center gap-2">
                  <Flag
                    showName
                    flag={m.away?.flag}
                    name={m.away?.name ?? m.away_placeholder}
                    sigla={m.away?.sigla ?? m.away_placeholder}
                  />
                </div>
              </div>
              {!disabled && (
                <div className="mt-3 flex justify-end border-t border-white/5 pt-3">
                  <Button
                    type="button"
                    size="sm"
                    disabled={!changed || savingMatchId === m.id}
                    onClick={() => saveMatch(m.id)}
                    className="font-black uppercase tracking-widest"
                  >
                    <Save /> {savingMatchId === m.id ? "Salvando..." : "Salvar este palpite"}
                  </Button>
                </div>
              )}
              {hasResult && (
                <div className="mt-2 text-center text-xs text-slate-400">
                  Resultado oficial: {m.home_score} × {m.away_score}
                </div>
              )}
              {(m.status === "finished" ||
                m.status === "live" ||
                (m.status === "scheduled" && new Date(m.kickoff_at) <= new Date())) && (
                <div className="mt-3 flex justify-end border-t border-white/5 pt-3">
                  <MatchParticipantPredictions match={m} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Tournament predictions */}
        </TabsContent>

        <TabsContent value="classificados" className="space-y-6 mt-6">
          <BracketClassificados
            teams={teams}
            values={Object.fromEntries(
              Array.from(new Set([...Object.keys(existingTp), ...Object.keys(tp)])).map((k) => [
                k,
                tp[k] !== undefined ? tp[k] : (existingTp[k] ?? ""),
              ]),
            )}
            setValue={(k, v) => setTp((s) => ({ ...s, [k]: v }))}
            locked={tournamentLocked}
            deadline={tournamentDeadline}
          />
        </TabsContent>
      </Tabs>

      <button
        onClick={() => setConfirmOpen(true)}
        disabled={submitting}
        className="fixed bottom-4 left-4 right-4 md:static md:w-full bg-grass text-night font-black uppercase py-4 text-lg tracking-tighter disabled:opacity-50 z-30"
      >
        Salvar Palpites
      </button>

      {confirmOpen && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-night border border-white/10 max-w-md w-full p-6 space-y-4">
            <h3 className="font-display text-3xl uppercase italic">Salvar Palpites</h3>
            <p className="text-slate-400 text-sm">
              Seus palpites serão salvos. Você poderá <b className="text-white">editar cada jogo</b>{" "}
              até o seu início. Deseja continuar?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmOpen(false)}
                className="flex-1 border border-white/20 py-3 font-bold uppercase tracking-widest text-xs"
              >
                Cancelar
              </button>
              <button
                onClick={doSubmit}
                disabled={submitting}
                className="flex-1 bg-grass text-night py-3 font-black uppercase tracking-tighter disabled:opacity-50"
              >
                {submitting ? "Salvando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {randomOpen && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-night border border-white/10 max-w-md w-full p-6 space-y-4">
            <h3 className="font-display text-3xl uppercase italic">Preencher Aleatório</h3>
            <p className="text-slate-400 text-sm">
              Deseja preencher todos os palpites <b className="text-white">ainda em aberto</b> com
              resultados aleatórios (0 a 4 gols)? Os palpites já enviados não serão alterados. Você
              ainda poderá editar manualmente antes de enviar.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setRandomOpen(false)}
                className="flex-1 border border-white/20 py-3 font-bold uppercase tracking-widest text-xs"
              >
                Cancelar
              </button>
              <button
                onClick={fillRandom}
                className="flex-1 bg-gold text-night py-3 font-black uppercase tracking-tighter"
              >
                Preencher
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TournamentSection({
  teams,
  value,
  existing,
  locked,
  deadline,
  onChange,
}: {
  teams: Team[];
  value: Record<string, string>;
  existing: Record<string, string>;
  locked: boolean;
  deadline: Date;
  onChange: (k: string, v: string) => void;
}) {
  const groups = Array.from(new Set(teams.map((t) => t.group_letter).filter(Boolean))) as string[];
  function CountrySelect({ k, options }: { k: string; options?: Team[] }) {
    const v = value[k] ?? existing[k] ?? "";
    const list = options ?? teams;
    const selected = list.find((t) => t.id === v) ?? teams.find((t) => t.id === v);
    const [open, setOpen] = useState(false);

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={locked}
            className={cn(
              "flex w-full items-center justify-between gap-2 bg-white/5 border border-white/10 px-3 py-2.5 text-left text-sm disabled:opacity-60",
              !selected && "text-slate-500",
            )}
          >
            {selected ? (
              <span className="inline-flex items-center gap-2 min-w-0">
                {selected.flag && (
                  <span className="text-lg leading-none shrink-0">{selected.flag}</span>
                )}
                <span className="truncate font-bold uppercase tracking-tight text-xs">
                  {selected.name}
                </span>
              </span>
            ) : (
              <span>Selecione um país</span>
            )}
            {selected && !locked ? (
              <X
                className="ml-auto size-4 shrink-0 opacity-60 hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(k, "");
                }}
              />
            ) : (
              <ChevronsUpDown className="ml-auto size-4 shrink-0 opacity-60" />
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[260px] sm:w-[300px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Buscar país..." className="h-10" />
            <CommandList className="max-h-[260px]">
              <CommandEmpty>Nenhum país encontrado.</CommandEmpty>
              <CommandGroup>
                {list.map((t) => (
                  <CommandItem
                    key={t.id}
                    value={`${t.name} ${t.sigla}`}
                    onSelect={() => {
                      onChange(k, t.id);
                      setOpen(false);
                    }}
                    className="flex items-center gap-2"
                  >
                    {t.flag && <span className="text-lg leading-none shrink-0">{t.flag}</span>}
                    <span className="font-bold uppercase tracking-tight text-xs">{t.name}</span>
                    {v === t.id && <CheckCircle2 className="ml-auto size-4 text-grass shrink-0" />}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    );
  }
  return (
    <div className="space-y-6 border-t border-white/10 pt-6">
      <h2 className="font-display text-3xl uppercase italic">Palpites de Classificação</h2>
      {locked ? (
        <div className="bg-victory/10 border border-victory/30 p-3 text-xs text-slate-300 flex items-center gap-2">
          <Lock className="size-4 text-victory" /> Palpites de classificação bloqueados (prazo
          encerrado em{" "}
          {deadline.toLocaleString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
          ).
        </div>
      ) : (
        <div className="bg-grass/10 border border-grass/30 p-3 text-xs text-slate-300 flex items-center gap-2">
          <Clock className="size-4 text-grass" /> Você pode editar seus palpites de classificação
          até{" "}
          {deadline.toLocaleString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
          .
        </div>
      )}

      <div>
        <h3 className="text-xs uppercase tracking-widest text-slate-500 mb-3">
          Classificados dos Grupos
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {groups.map((g) => {
            const groupTeams = teams.filter((t) => t.group_letter === g);
            return (
            <div key={g} className="bg-white/5 border border-white/10 p-3">
              <div className="font-display text-xl mb-2">Grupo {g}</div>
              <label className="text-[10px] uppercase tracking-widest text-slate-500">
                1º colocado
              </label>
              <CountrySelect k={`group_1st|${g}`} options={groupTeams} />
              <label className="text-[10px] uppercase tracking-widest text-slate-500 mt-2 block">
                2º colocado
              </label>
              <CountrySelect k={`group_2nd|${g}`} options={groupTeams} />
            </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {[
          ["champion", "Campeão", "🏆"],
          ["runner_up", "Vice-campeão", "🥈"],
          ["third", "Terceiro lugar", "🥉"],
          ["fourth_place", "Quarto lugar", "🏅"],
        ].map(([k, l, e]) => (
          <div key={k} className="bg-white/5 border border-white/10 p-3">
            <div className="font-display text-xl mb-2">
              {e} {l}
            </div>
            <CountrySelect k={`${k}|`} />
          </div>
        ))}
      </div>
    </div>
  );
}
