import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Trophy } from "lucide-react";
import { getTournamentPredictionsOverview } from "@/lib/api/predictions.functions";
import { Flag } from "@/components/app/Flag";

type OverviewData = Awaited<ReturnType<typeof getTournamentPredictionsOverview>>;

export function TournamentPredictionsOverview() {
  const loadOverview = useServerFn(getTournamentPredictionsOverview);
  const [data, setData] = useState<OverviewData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    loadOverview()
      .then(setData)
      .catch((caught) =>
        setError(caught instanceof Error ? caught.message : "Não foi possível carregar os palpites."),
      );
  }, [loadOverview]);

  if (error) return <p className="py-8 text-center text-sm text-victory">{error}</p>;
  if (!data)
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-xs uppercase tracking-widest text-slate-500">
        <Loader2 className="animate-spin" /> Carregando classificados...
      </div>
    );

  return (
    <section className="space-y-3" aria-labelledby="tp-overview-title">
      <div>
        <h2 id="tp-overview-title" className="font-display text-3xl uppercase italic">
          Pontuação por classificados
        </h2>
        <p className="text-xs uppercase tracking-widest text-slate-500">
          Arraste para o lado para ver os palpites de classificação e finais
        </p>
      </div>
      <div className="max-h-[70dvh] overflow-auto border border-white/10">
        <table className="min-w-max border-collapse text-sm">
          <thead className="sticky top-0 z-20 bg-night">
            <tr className="border-b border-white/10">
              <th className="sticky left-0 z-30 min-w-40 bg-night px-3 py-3 text-left text-[10px] uppercase tracking-widest text-slate-400">
                Jogador
              </th>
              {data.slots.map((slot) => (
                <th key={slot.key} className="min-w-24 px-2 py-3 text-center">
                  <span className="flex items-center justify-center gap-1 font-display text-sm uppercase">
                    {(slot.pred_type === "champion" ||
                      slot.pred_type === "runner_up" ||
                      slot.pred_type === "third" ||
                      slot.pred_type === "fourth_place") && (
                      <Trophy className="h-3 w-3 text-gold" />
                    )}
                    {slot.label}
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
                  <span className="text-[10px] font-normal text-grass">
                    {participant.total_class_points} pts classificados
                  </span>
                </th>
                {data.slots.map((slot) => {
                  const cell = participant.cells[slot.key];
                  if (!cell?.team) {
                    return (
                      <td key={slot.key} className="px-2 py-3 text-center text-slate-600">
                        —
                      </td>
                    );
                  }
                  return (
                    <td
                      key={slot.key}
                      className={`px-2 py-3 text-center ${cell.correct ? "bg-grass/10" : ""}`}
                    >
                      <span className="flex flex-col items-center gap-1">
                        <Flag
                          flag={cell.team.flag}
                          name={cell.team.name}
                          sigla={cell.team.sigla}
                          showName
                        />
                        <span
                          className={`font-display text-base ${cell.points > 0 ? "text-gold" : "text-slate-600"}`}
                        >
                          +{cell.points}
                        </span>
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
