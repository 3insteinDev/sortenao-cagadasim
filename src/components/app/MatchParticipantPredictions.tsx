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

type ParticipantData = Awaited<ReturnType<typeof getMatchParticipantPredictions>>;

export function MatchParticipantPredictions({ match }: { match: MatchSummary }) {
  const loadPredictions = useServerFn(getMatchParticipantPredictions);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<ParticipantData | null>(null);
  const hasStarted = match.status !== "scheduled" || new Date(match.kickoff_at) <= new Date();

  async function handleOpen() {
    if (!hasStarted) return;
    setOpen(true);
    if (data) return;
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
        disabled={!hasStarted}
        onClick={handleOpen}
        className="border-white/10 bg-white/5 text-[10px] font-black uppercase tracking-widest hover:bg-white/10"
      >
        {hasStarted ? <Eye /> : <Lock />}
        {hasStarted ? "Ver palpites" : "Palpites fechados"}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-hidden border-white/10 bg-night p-0 text-foreground sm:rounded-none">
          <DialogHeader className="border-b border-white/10 p-5 pr-12 text-left">
            <DialogTitle className="font-display text-3xl uppercase italic">
              Palpites da partida
            </DialogTitle>
            <DialogDescription>
              Palpites revelados após o início · pontuação{" "}
              {data?.match.status === "finished" ? "final" : "parcial"}
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
            <div className="overflow-y-auto">
              <div className="sticky top-0 z-10 flex items-center justify-center gap-3 border-b border-white/10 bg-night p-4">
                <Flag
                  flag={data.match.home?.flag}
                  name={data.match.home?.name ?? data.match.home_placeholder}
                  sigla={data.match.home?.sigla ?? data.match.home_placeholder}
                />
                <span className="font-display text-3xl">
                  {data.match.home_score ?? "–"} × {data.match.away_score ?? "–"}
                </span>
                <Flag
                  flag={data.match.away?.flag}
                  name={data.match.away?.name ?? data.match.away_placeholder}
                  sigla={data.match.away?.sigla ?? data.match.away_placeholder}
                />
              </div>
              <div className="divide-y divide-white/5 px-4 pb-4">
                {data.participants.map((participant) => (
                  <div
                    key={participant.id}
                    className={`grid grid-cols-[1fr_auto_auto] items-center gap-3 py-3 ${participant.is_current_user ? "text-gold" : ""}`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold uppercase">
                        {participant.nickname}
                        {participant.is_current_user ? " · Você" : ""}
                      </p>
                    </div>
                    <span className="min-w-16 text-center font-display text-2xl text-foreground">
                      {participant.prediction
                        ? `${participant.prediction.home_score} × ${participant.prediction.away_score}`
                        : "—"}
                    </span>
                    <span
                      className={`flex min-w-14 items-center justify-end gap-1 font-display text-xl ${participant.points > 0 ? "text-grass" : "text-slate-600"}`}
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
