import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { setMatchResult, recalculateAll, toggleUserBlock, updateMatchTeams } from "@/lib/api/admin.functions";
import { Flag } from "@/components/app/Flag";
import { PHASE_LABEL, type Phase } from "@/lib/db/types";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id);
    if (!roles?.some((r) => r.role === "admin")) throw redirect({ to: "/dashboard" });
  },
  component: Admin,
});

function Admin() {
  const [tab, setTab] = useState<"matches" | "users" | "actions">("matches");
  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="font-display text-5xl uppercase italic mb-6">Painel Admin</h1>
      <div className="flex gap-2 border-b border-white/10 mb-6">
        {(["matches","users","actions"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-xs uppercase tracking-widest font-bold ${tab===t?"text-grass border-b-2 border-grass":"text-slate-500"}`}>
            {t === "matches" ? "Jogos" : t === "users" ? "Usuários" : "Ações"}
          </button>
        ))}
      </div>
      {tab === "matches" && <MatchesTab />}
      {tab === "users" && <UsersTab />}
      {tab === "actions" && <ActionsTab />}
    </div>
  );
}

function MatchesTab() {
  const [matches, setMatches] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [filter, setFilter] = useState<Phase | "all">("group");
  const setResult = useServerFn(setMatchResult);
  const setTeamsFn = useServerFn(updateMatchTeams);

  async function reload() {
    const [m, t] = await Promise.all([
      supabase.from("matches").select("*, home:home_team_id(name,sigla,flag), away:away_team_id(name,sigla,flag)").order("kickoff_at"),
      supabase.from("teams").select("*").order("name"),
    ]);
    setMatches(m.data ?? []); setTeams(t.data ?? []);
  }
  useEffect(() => { reload(); }, []);

  const visible = filter === "all" ? matches : matches.filter((m) => m.phase === filter);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(["all","group","r32","r16","qf","sf","third","final"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest border ${filter===f?"bg-grass text-night border-grass":"border-white/10 text-slate-400"}`}>
            {f === "all" ? "Todos" : PHASE_LABEL[f]}
          </button>
        ))}
      </div>
      <div className="space-y-2">
        {visible.map((m) => (
          <div key={m.id} className="bg-white/5 border border-white/10 p-3">
            <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">{PHASE_LABEL[m.phase as Phase]} · {m.match_code}</div>
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr_auto] gap-2 items-center">
              <TeamSelect teams={teams} value={m.home_team_id} placeholder={m.home_placeholder} onChange={(v: string | null) => setTeamsFn({ data: { match_id: m.id, home_team_id: v, away_team_id: m.away_team_id } }).then(reload)} />
              <ScoreEditor m={m} onSave={async (h: number, a: number) => { await setResult({ data: { match_id: m.id, home_score: h, away_score: a, status: "finished" } }); toast.success("Salvo"); reload(); }} />
              <TeamSelect teams={teams} value={m.away_team_id} placeholder={m.away_placeholder} onChange={(v: string | null) => setTeamsFn({ data: { match_id: m.id, home_team_id: m.home_team_id, away_team_id: v } }).then(reload)} />
              <span className={`text-[10px] uppercase tracking-widest ${m.status==="finished"?"text-grass":"text-slate-500"}`}>{m.status}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TeamSelect({ teams, value, placeholder, onChange }: any) {
  return (
    <select value={value ?? ""} onChange={(e) => onChange(e.target.value || null)} className="bg-night border border-white/10 px-2 py-2 text-sm">
      <option value="">{placeholder ?? "—"}</option>
      {teams.map((t: any) => <option key={t.id} value={t.id}>{t.flag} {t.name}</option>)}
    </select>
  );
}

function ScoreEditor({ m, onSave }: any) {
  const [h, setH] = useState(m.home_score ?? "");
  const [a, setA] = useState(m.away_score ?? "");
  useEffect(() => { setH(m.home_score ?? ""); setA(m.away_score ?? ""); }, [m.home_score, m.away_score]);
  return (
    <div className="flex items-center gap-1">
      <input value={h} onChange={(e) => setH(e.target.value.replace(/\D/g, ""))} className="w-12 bg-night border border-white/10 text-center py-1 font-display" />
      <span>×</span>
      <input value={a} onChange={(e) => setA(e.target.value.replace(/\D/g, ""))} className="w-12 bg-night border border-white/10 text-center py-1 font-display" />
      <button onClick={() => onSave(parseInt(h || "0", 10), parseInt(a || "0", 10))} className="bg-grass text-night px-2 py-1 text-[10px] uppercase font-black ml-1">OK</button>
    </div>
  );
}

function UsersTab() {
  const [users, setUsers] = useState<any[]>([]);
  const toggle = useServerFn(toggleUserBlock);
  async function reload() {
    const { data } = await supabase.from("profiles").select("*").order("total_points", { ascending: false });
    setUsers(data ?? []);
  }
  useEffect(() => { reload(); }, []);
  return (
    <div className="space-y-2">
      {users.map((u) => (
        <div key={u.id} className="bg-white/5 p-3 flex items-center justify-between">
          <div>
            <div className="font-bold uppercase text-sm">{u.nickname}</div>
            <div className="text-[10px] text-slate-500">{u.full_name}</div>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-display text-lg">{u.total_points} pts</span>
            <button onClick={async () => { await toggle({ data: { user_id: u.id, blocked: !u.blocked } }); toast.success("Atualizado"); reload(); }}
              className={`px-3 py-1 text-[10px] uppercase font-bold tracking-widest ${u.blocked?"bg-victory text-white":"bg-white/10"}`}>
              {u.blocked ? "Bloqueado" : "Bloquear"}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function ActionsTab() {
  const recalc = useServerFn(recalculateAll);
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-4 max-w-md">
      <button onClick={async () => { setBusy(true); try { const r = await recalc({}); toast.success(`Recalculado para ${r.profiles} usuários`); } catch (e: any) { toast.error(e.message); } finally { setBusy(false); } }}
        disabled={busy} className="w-full bg-grass text-night font-black uppercase py-4 tracking-tighter disabled:opacity-50">
        {busy ? "Recalculando..." : "Recalcular Pontuações"}
      </button>
      <p className="text-xs text-slate-500 uppercase tracking-widest">Reprocessa todos os palpites com base nos resultados oficiais e atualiza o ranking.</p>
    </div>
  );
}