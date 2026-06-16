import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Eye, Loader2, Lock, Target, Users } from "lucide-react";
import { getMatchParticipantPredictions } from "@/lib/api/predictions.functions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Flag } from "@/components/app/Flag";

type MatchSummary = {
  id: string;
  status: "scheduled" | "live" | "finished";
  kickoff_at: string;
};

function hasMatchStarted(match: MatchSummary) {
  if (match.status === "finished" || match.status === "live") return true;
  return match.status === "scheduled" && new Date(match.kickoff_at) <= new Date();
}

type ParticipantData = Awaited<ReturnType<typeof getMatchParticipantPredictions>>;

export function MatchParticipantPredictions({ match }: { match: MatchSummary }) {
  const loadPredictions = useServerFn(getMatchParticipantPredictions);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<ParticipantData | null>(null);
  const isAvailable = hasMatchStarted(match);
  const isLive = match.status === "live";

  function pointsColor(points: number) {
    if (points === 10 || points === 15) return "text-gold";
    if (points === 7 || points === 8) return "text-grass";
    if (points === 5) return "text-foreground";
    if (points === 2 || points === 3) return "text-slate-400";
    return "text-slate-600";
  }

  async function handleOpen() {
    if (!isAvailable) return;
    setOpen(true);
    if (data && !isLive) return;
    setLoading(true);
    setError("");
    try {
      setData(await loadPredictions({ data: { match_id: match.id } }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível carregar os palpites.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!isAvailable}
        onClick={handleOpen}
        className="border-white/10 bg-white/5 text-[10px] font-black uppercase tracking-widest hover:bg-white/10"
      >
        {isAvailable ? <Eye /> : <Lock />}
        {isAvailable
          ? isLive
            ? "Ver palpites (ao vivo)"
            : "Ver palpites"
          : "Disponível após o início"}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-2xl flex-col overflow-hidden border-white/10 bg-night p-0 text-foreground sm:max-h-[85vh] sm:rounded-none">
          <DialogHeader className="shrink-0 border-b border-white/10 p-4 pr-12 text-left sm:p-5 sm:pr-12">
            <DialogTitle className="font-display text-2xl uppercase italic sm:text-3xl">
              Palpites da partida
            </DialogTitle>
            <DialogDescription>
              {isLive
                ? "Acompanhe os palpites em tempo real · pontuação parcial"
                : "Palpites revelados · pontuação final"}
            </DialogDescription>
          </DialogHeader>

          {loading && (
            <div className="flex items-center justify-center gap-2 p-12 text-xs uppercase tracking-widest text-slate-500">
              <Loader2 className="animate-spin" /> Carregando participantes...
            </div>
          )}
          {error && (
            <p role="alert" className="p-8 text-center text-sm text-victory">
              {error}
            </p>
          )}
          {data && (
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <div className="sticky top-0 z-10 flex items-center justify-center gap-2 border-b border-white/10 bg-night p-3 sm:gap-3 sm:p-4">
                <Flag
                  flag={data.match.home?.flag}
                  name={data.match.home?.name ?? data.match.home_placeholder}
                  sigla={data.match.home?.sigla ?? data.match.home_placeholder}
                />
                <span className="whitespace-nowrap font-display text-2xl sm:text-3xl">
                  {data.match.home_score ?? "–"} × {data.match.away_score ?? "–"}
                </span>
                <Flag
                  flag={data.match.away?.flag}
                  name={data.match.away?.name ?? data.match.away_placeholder}
                  sigla={data.match.away?.sigla ?? data.match.away_placeholder}
                />
              </div>
              <div className="divide-y divide-white/5 px-3 pb-4 sm:px-4">
                {data.participants.map((participant) => (
                  <div
                    key={participant.id}
                    className={`grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 py-3 sm:gap-3 ${participant.is_current_user ? "text-gold" : ""}`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold uppercase">
                        {participant.nickname}
                        {participant.is_current_user ? " · Você" : ""}
                      </p>
                    </div>
                    <span className="min-w-14 text-center font-display text-xl text-foreground sm:min-w-16 sm:text-2xl">
                      {participant.prediction
                        ? `${participant.prediction.home_score} × ${participant.prediction.away_score}`
                        : "—"}
                    </span>
                    <span
                      className={`flex min-w-12 items-center justify-end gap-1 font-display text-lg sm:min-w-14 sm:text-xl ${pointsColor(participant.points)}`}
                    >
                      <Target className="size-3" /> +{participant.points}
                    </span>
                  </div>
                ))}
                {data.participants.length === 0 && (
                  <p className="flex items-center justify-center gap-2 py-10 text-xs uppercase tracking-widest text-slate-500">
                    <Users /> Nenhum participante
                  </p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
