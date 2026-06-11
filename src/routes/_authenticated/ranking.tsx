import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/ranking")({ component: RankingPage });

function RankingPage() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    supabase.rpc("get_leaderboard").then(({ data }) => setRows(data ?? []));
  }, []);
  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="font-display text-5xl uppercase italic mb-8">Ranking Geral</h1>
      <div className="space-y-2">
        {rows.map((r, i) => {
          const pos = i + 1;
          const trend = r.prev_rank ? (r.prev_rank > pos ? "⬆️" : r.prev_rank < pos ? "⬇️" : "➖") : "";
          return (
            <div key={r.id} className={`flex items-center gap-4 p-4 border-l-4 ${pos===1?"border-gold bg-gold/10":pos===2?"border-slate-400 bg-white/5":pos===3?"border-amber-700 bg-amber-700/10":"border-slate-700 bg-white/5"}`}>
              <span className="font-display text-2xl w-10 text-center">{pos}</span>
              <div className="flex-1 min-w-0">
                <div className="font-bold uppercase text-sm truncate">{r.nickname}</div>
                <div className="text-[10px] uppercase tracking-widest text-slate-500">{r.total_hits} acertos</div>
              </div>
              <span className="text-sm">{trend}</span>
              <span className="font-display text-2xl text-grass">{r.total_points}</span>
            </div>
          );
        })}
        {rows.length === 0 && <p className="text-center text-slate-500 py-12 uppercase tracking-widest text-sm">Nenhum participante ainda</p>}
      </div>
    </div>
  );
}