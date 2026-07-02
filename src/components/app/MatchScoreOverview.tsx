import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Table2 } from "lucide-react";
import { getFinishedMatchScores } from "@/lib/api/predictions.functions";

type OverviewData = Awaited<ReturnType<typeof getFinishedMatchScores>>;

function pointsColor(points: number) {
  if (points === 10 || points === 15) return "text-gold";
  if (points === 11) return "text-gold";
  if (points === 7 || points === 8) return "text-grass";
  if (points === 5) return "text-foreground";
  if (points === 2 || points === 3) return "text-slate-400";
  return "text-slate-600";
}

export function MatchScoreOverview() {
  const loadOverview = useServerFn(getFinishedMatchScores);
  const [data, setData] = useState<OverviewData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    loadOverview()
      .then(setData)
      .catch((caught) =>
        setError(caught instanceof Error ? caught.message : "Não foi possível carregar os jogos."),
      );
  }, [loadOverview]);

  if (error) return <p className="py-8 text-center text-sm text-victory">{error}</p>;
  if (!data)
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-xs uppercase tracking-widest text-slate-500">
        <Loader2 className="animate-spin" /> Carregando pontuações...
      </div>
    );

  if (data.matches.length === 0)
    return (
      <p className="flex items-center justify-center gap-2 py-12 text-xs uppercase tracking-widest text-slate-500">
        <Table2 /> Nenhum jogo finalizado
      </p>
    );

  return (
    <section className="space-y-3" aria-labelledby="match-overview-title">
      <div>
        <h2 id="match-overview-title" className="font-display text-3xl uppercase italic">
          Pontuação por jogo
        </h2>
        <p className="text-xs uppercase tracking-widest text-slate-500">
          Arraste para o lado para consultar todos os jogos finalizados
        </p>
      </div>
      <div className="max-h-[70dvh] overflow-auto border border-white/10">
        <table className="min-w-max border-collapse text-sm">
          <thead className="sticky top-0 z-20 bg-night">
            <tr className="border-b border-white/10">
              <th className="sticky left-0 z-30 min-w-40 bg-night px-3 py-3 text-left text-[10px] uppercase tracking-widest text-slate-400">
                Jogador
              </th>
              {data.matches.map((match) => (
                <th key={match.id} className="min-w-28 px-2 py-3 text-center">
                  <span className="block font-display text-lg">
                    {match.home?.sigla ?? match.home_placeholder} ×{" "}
                    {match.away?.sigla ?? match.away_placeholder}
                  </span>
                  <span className="text-[10px] font-normal text-slate-500">
                    {match.home_score} × {match.away_score}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.participants.map((participant) => (
              <tr
                key={participant.id}
                className={`border-b border-white/5 ${participant.is_current_user ? "bg-gold/5" : ""}`}
              >
                <th className="sticky left-0 z-10 max-w-48 bg-night px-3 py-3 text-left font-bold uppercase">
                  <span className="block truncate">
                    {participant.nickname}
                    {participant.is_current_user ? " · Você" : ""}
                  </span>
                  <span className="text-[10px] font-normal text-slate-500">
                    {participant.total_points} pts no total
                  </span>
                </th>
                {data.matches.map((match) => {
                  const score = participant.scores[match.id];
                  return (
                    <td key={match.id} className="px-2 py-3 text-center">
                      <span className="block text-xs text-slate-400">
                        {score?.prediction ?? "—"}
                      </span>
                      <span className={`font-display text-xl ${pointsColor(score?.points ?? 0)}`}>
                        +{score?.points ?? 0}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
