import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/perfil")({ component: Profile });

function Profile() {
  const [p, setP] = useState<any>(null);
  const [achievements, setAchievements] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const [a, b, c] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", u.user.id).single(),
        supabase.from("achievements").select("*").eq("user_id", u.user.id).order("earned_at",{ascending:false}),
        supabase.from("predictions").select("points,submitted_at").eq("user_id", u.user.id).order("submitted_at",{ascending:false}).limit(20),
      ]);
      setP(a.data); setAchievements(b.data ?? []); setHistory(c.data ?? []);
    })();
  }, []);

  async function save() {
    const { error } = await supabase.from("profiles").update({ full_name: p.full_name, nickname: p.nickname }).eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success("Salvo");
  }

  if (!p) return <div className="p-8 text-center text-slate-500 uppercase tracking-widest">Carregando...</div>;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 sm:py-8 space-y-6 sm:space-y-8">
      <h1 className="font-display text-3xl sm:text-5xl uppercase italic">Perfil</h1>
      <div className="bg-white/5 border border-white/10 p-4 sm:p-6 space-y-4">
        <div>
          <label className="text-[10px] uppercase tracking-widest text-slate-500 block mb-1">Nome completo</label>
          <input className="w-full bg-white/5 border border-white/10 px-4 py-2" value={p.full_name ?? ""} onChange={(e) => setP({ ...p, full_name: e.target.value })} />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-widest text-slate-500 block mb-1">Apelido</label>
          <input className="w-full bg-white/5 border border-white/10 px-4 py-2" value={p.nickname ?? ""} onChange={(e) => setP({ ...p, nickname: e.target.value })} />
        </div>
        <button onClick={save} className="bg-grass text-night px-6 py-2 font-black uppercase tracking-tighter">Salvar</button>
      </div>

      <div>
        <h2 className="font-display text-2xl uppercase italic mb-3">Conquistas ({achievements.length})</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {achievements.map((a) => (
            <div key={a.id} className="bg-white/5 border border-gold/30 p-4 text-center">
              <div className="text-3xl mb-1">{a.icon ?? "🏅"}</div>
              <div className="text-xs font-bold uppercase">{a.title}</div>
            </div>
          ))}
          {achievements.length === 0 && <p className="text-slate-500 text-sm col-span-4 text-center py-6 uppercase tracking-widest">Sem conquistas ainda</p>}
        </div>
      </div>

      <div>
        <h2 className="font-display text-2xl uppercase italic mb-3">Histórico</h2>
        <div className="space-y-1">
          {history.map((h, i) => (
            <div key={i} className="bg-white/5 px-4 py-2 flex justify-between text-sm">
              <span className="text-slate-500">{new Date(h.submitted_at).toLocaleDateString("pt-BR")}</span>
              <span className={`font-display ${h.points > 0 ? "text-grass" : "text-slate-600"}`}>+{h.points}</span>
            </div>
          ))}
          {history.length === 0 && <p className="text-slate-500 text-center py-6 uppercase tracking-widest text-sm">Sem palpites ainda</p>}
        </div>
      </div>
    </div>
  );
}