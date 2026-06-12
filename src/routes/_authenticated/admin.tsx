import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import {
  setMatchResult,
  recalculateAll,
  updateMatchTeams,
  listAdminUsers,
  adminUpdateUser,
  adminDeleteUser,
  syncResultsNow,
} from "@/lib/api/admin.functions";
import { PHASE_LABEL, type Phase } from "@/lib/db/types";
import { toast } from "sonner";
import { Loader2, Pencil, Trash2, RefreshCw } from "lucide-react";

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
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any | null>(null);
  const [deleting, setDeleting] = useState<any | null>(null);
  const list = useServerFn(listAdminUsers);
  const update = useServerFn(adminUpdateUser);
  const del = useServerFn(adminDeleteUser);

  async function reload() {
    setLoading(true);
    try {
      const data = await list();
      setUsers(data as any[]);
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao carregar usuários");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { reload(); }, []);

  if (loading) return <div className="py-8 text-center text-slate-500 uppercase tracking-widest text-xs flex items-center justify-center gap-2"><Loader2 className="size-4 animate-spin" /> Carregando usuários...</div>;

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-[10px] uppercase tracking-widest text-slate-500 border-b border-white/10">
              <th className="text-left py-2 px-2">Apelido / Nome</th>
              <th className="text-left py-2 px-2 hidden md:table-cell">Email</th>
              <th className="text-left py-2 px-2 hidden lg:table-cell">Cadastro</th>
              <th className="text-right py-2 px-2">Palpites</th>
              <th className="text-right py-2 px-2">Pontos</th>
              <th className="text-center py-2 px-2">Status</th>
              <th className="text-right py-2 px-2">Ações</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-white/5 hover:bg-white/5">
                <td className="py-2 px-2">
                  <div className="font-bold uppercase text-sm">{u.nickname}</div>
                  <div className="text-[10px] text-slate-500">{u.full_name}</div>
                </td>
                <td className="py-2 px-2 text-xs text-slate-400 hidden md:table-cell">{u.email ?? "—"}</td>
                <td className="py-2 px-2 text-[10px] text-slate-500 hidden lg:table-cell">{u.auth_created_at ? new Date(u.auth_created_at).toLocaleDateString("pt-BR") : "—"}</td>
                <td className="py-2 px-2 text-right font-display text-lg">{u.predictions_count}</td>
                <td className="py-2 px-2 text-right font-display text-lg">{u.total_points}</td>
                <td className="py-2 px-2 text-center">
                  <span className={`px-2 py-0.5 text-[10px] uppercase font-bold tracking-widest ${u.blocked ? "bg-victory text-white" : "bg-grass/20 text-grass"}`}>
                    {u.blocked ? "Inativo" : "Ativo"}
                  </span>
                </td>
                <td className="py-2 px-2">
                  <div className="flex justify-end gap-1">
                    <button onClick={() => setEditing(u)} title="Editar" className="p-2 hover:bg-white/10"><Pencil className="size-4" /></button>
                    <button onClick={() => setDeleting(u)} title="Excluir" className="p-2 hover:bg-victory/30 text-victory"><Trash2 className="size-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <EditUserModal user={editing} onClose={() => setEditing(null)} onSave={async (patch) => {
          try {
            await update({ data: { user_id: editing.id, ...patch } });
            toast.success("Usuário atualizado");
            setEditing(null);
            reload();
          } catch (e: any) {
            toast.error(e.message ?? "Erro ao atualizar");
          }
        }} />
      )}

      {deleting && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-night border border-victory/30 max-w-md w-full p-6 space-y-4">
            <h3 className="font-display text-3xl uppercase italic text-victory">Excluir Usuário</h3>
            <p className="text-slate-300 text-sm">
              Tem certeza que deseja excluir <b className="text-white">{deleting.nickname}</b>?
            </p>
            <p className="text-slate-400 text-xs">
              Esta ação <b>não pode ser desfeita</b>. Todos os palpites, palpites de classificação, conquistas e dados vinculados a este usuário serão removidos permanentemente.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setDeleting(null)} className="flex-1 border border-white/20 py-3 font-bold uppercase tracking-widest text-xs">Cancelar</button>
              <button onClick={async () => {
                try {
                  await del({ data: { user_id: deleting.id } });
                  toast.success("Usuário excluído");
                  setDeleting(null);
                  reload();
                } catch (e: any) {
                  toast.error(e.message ?? "Erro ao excluir");
                }
              }} className="flex-1 bg-victory text-white py-3 font-black uppercase tracking-tighter">Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EditUserModal({ user, onClose, onSave }: { user: any; onClose: () => void; onSave: (patch: any) => Promise<void> }) {
  const [form, setForm] = useState({
    full_name: user.full_name ?? "",
    nickname: user.nickname ?? "",
    email: user.email ?? "",
    password: "",
    blocked: !!user.blocked,
  });
  const [saving, setSaving] = useState(false);
  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-night border border-white/10 max-w-md w-full p-6 space-y-4">
        <h3 className="font-display text-3xl uppercase italic">Editar Usuário</h3>
        <div className="space-y-3">
          <Field label="Nome completo">
            <input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="w-full bg-white/5 border border-white/10 px-3 py-2 text-sm" />
          </Field>
          <Field label="Apelido">
            <input value={form.nickname} onChange={(e) => setForm({ ...form, nickname: e.target.value })} className="w-full bg-white/5 border border-white/10 px-3 py-2 text-sm" />
          </Field>
          <Field label="Email">
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full bg-white/5 border border-white/10 px-3 py-2 text-sm" />
          </Field>
          <Field label="Nova senha (opcional, mín. 6 caracteres)">
            <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full bg-white/5 border border-white/10 px-3 py-2 text-sm" placeholder="Deixe em branco para manter" />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.blocked} onChange={(e) => setForm({ ...form, blocked: e.target.checked })} />
            <span>Conta bloqueada (inativa)</span>
          </label>
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 border border-white/20 py-3 font-bold uppercase tracking-widest text-xs">Cancelar</button>
          <button disabled={saving} onClick={async () => {
            setSaving(true);
            const patch: any = {
              full_name: form.full_name,
              nickname: form.nickname,
              blocked: form.blocked,
            };
            if (form.email && form.email !== user.email) patch.email = form.email;
            if (form.password) patch.password = form.password;
            try { await onSave(patch); } finally { setSaving(false); }
          }} className="flex-1 bg-grass text-night py-3 font-black uppercase tracking-tighter disabled:opacity-50">
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-widest text-slate-500 block mb-1">{label}</label>
      {children}
    </div>
  );
}

function ActionsTab() {
  const recalc = useServerFn(recalculateAll);
  const sync = useServerFn(syncResultsNow);
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  return (
    <div className="space-y-6 max-w-md">
      <div className="space-y-2">
        <button onClick={async () => {
          setSyncing(true);
          try {
            const r = await sync({});
            toast.success(`Sincronizado: ${(r as any).updated} jogos atualizados de ${(r as any).fetched} encontrados.`);
          } catch (e: any) {
            toast.error(e.message ?? "Erro na sincronização");
          } finally { setSyncing(false); }
        }} disabled={syncing} className="w-full bg-white/10 border border-white/20 text-white font-black uppercase py-4 tracking-tighter disabled:opacity-50 inline-flex items-center justify-center gap-2">
          <RefreshCw className={`size-4 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Sincronizando..." : "Sincronizar Resultados (Football-Data)"}
        </button>
        <p className="text-xs text-slate-500 uppercase tracking-widest">
          Busca os resultados finalizados na Football-Data.org. Jogos marcados como “manual_override” não são sobrescritos.
        </p>
      </div>

      <button onClick={async () => { setBusy(true); try { const r = await recalc({}); toast.success(`Recalculado para ${r.profiles} usuários`); window.location.reload(); } catch (e: any) { toast.error(e.message); } finally { setBusy(false); } }}
        disabled={busy} className="w-full bg-grass text-night font-black uppercase py-4 tracking-tighter disabled:opacity-50">
        {busy ? "Recalculando..." : "Recalcular Pontuações"}
      </button>
      <p className="text-xs text-slate-500 uppercase tracking-widest">Reprocessa todos os palpites com base nos resultados oficiais e atualiza o ranking.</p>
    </div>
  );
}