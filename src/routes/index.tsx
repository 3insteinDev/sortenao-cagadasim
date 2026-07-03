import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/app/Header";
import { Trophy, Target, Medal, DollarSign, Copy, Check, Smartphone, User } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Bolão Copa 2026 — O maior bolão do mundo" },
      { name: "description", content: "Faça seus palpites para todos os jogos da Copa do Mundo 2026 e dispute o ranking geral." },
      { property: "og:title", content: "Bolão Copa 2026" },
      { property: "og:description", content: "Desafie seus amigos, suba no pódio e conquiste a glória eterna." },
    ],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(landingQuery);
  },
  component: Landing,
});

const landingQuery = queryOptions({
  queryKey: ["landing"],
  queryFn: async () => {
    const [ranking, stats, settings] = await Promise.all([
      supabase.from("profiles").select("id,nickname,avatar_url,total_points,total_hits").order("total_points",{ ascending:false }).limit(10),
      Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("predictions").select("id", { count: "exact", head: true }),
        supabase.from("matches").select("id", { count: "exact", head: true }).eq("status","finished"),
        supabase.from("matches").select("id", { count: "exact", head: true }).neq("status","finished"),
      ]),
      supabase.from("settings").select("key,value"),
    ]);
    const settingsMap = Object.fromEntries((settings.data ?? []).map((s) => [s.key, s.value]));
    return {
      ranking: ranking.data ?? [],
      stats: {
        participants: stats[0].count ?? 0,
        predictions: stats[1].count ?? 0,
        finished: stats[2].count ?? 0,
        remaining: stats[3].count ?? 0,
      },
      cupStart: settingsMap.cup_start as string ?? "2026-06-11T20:00:00Z",
      cupName: (settingsMap.cup_name as string) ?? "Bolão Copa 2026",
    };
  },
});

function useCountdown(target: string) {
  const [t, setT] = useState({ d: 0, h: 0, m: 0, s: 0 });
  useEffect(() => {
    const tick = () => {
      const diff = Math.max(0, new Date(target).getTime() - Date.now());
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff / 3600000) % 24);
      const m = Math.floor((diff / 60000) % 60);
      const s = Math.floor((diff / 1000) % 60);
      setT({ d, h, m, s });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target]);
  return t;
}

function CopyPixButton() {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText("19983972249");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };
  return (
    <button
      onClick={handleCopy}
      className="w-full flex items-center justify-center gap-2 bg-grass hover:brightness-110 text-night font-black uppercase py-4 text-lg tracking-tighter transition-all active:scale-95 rounded-lg"
    >
      {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
      {copied ? "Chave Copiada!" : "Copiar Chave Pix"}
    </button>
  );
}

function Landing() {
  const { data } = useSuspenseQuery(landingQuery);
  const cd = useCountdown(data.cupStart);
  const podium = data.ranking.slice(0, 3);
  const rest = data.ranking.slice(3);

  return (
    <div className="min-h-screen bg-night text-white selection:bg-grass selection:text-night">
      <Header />

      {/* HERO */}
      <header className="relative overflow-hidden pt-12 pb-20 px-6">
        <div className="absolute inset-0 opacity-25 pointer-events-none bg-[radial-gradient(ellipse_at_top,var(--grass),transparent_60%)]" />
        <div className="relative z-10 max-w-xl mx-auto text-center md:text-left">
          <div className="inline-block bg-victory px-3 py-1 mb-6 skew-x-[-12deg]">
            <span className="block skew-x-[12deg] font-display text-sm tracking-widest uppercase">Road to 2026</span>
          </div>
          <h1 className="font-display text-6xl md:text-7xl leading-[0.9] mb-4 uppercase italic tracking-tighter">
            O Maior <br /><span className="text-grass">Bolão</span> do Mundo
          </h1>
          <p className="text-slate-400 text-lg leading-tight mb-8 font-medium">
            Desafie seus amigos, suba no pódio e conquiste a glória eterna na Copa de 2026.
          </p>

          <div className="grid grid-cols-4 gap-2 mb-8">
            {([["Dias",cd.d],["Hrs",cd.h],["Min",cd.m],["Seg",cd.s]] as const).map(([l, v], i) => (
              <div key={l} className="bg-white/5 border border-white/10 p-3 rounded-lg text-center">
                <span className={`block font-display text-3xl md:text-4xl tabular-nums ${i===0?"text-gold":""}`}>{String(v).padStart(2,"0")}</span>
                <span className="text-[10px] uppercase tracking-widest text-slate-500">{l}</span>
              </div>
            ))}
          </div>

          <Link to="/auth" className="block w-full bg-grass hover:brightness-110 text-night font-black uppercase py-5 text-xl tracking-tighter text-center transition-all active:scale-95">
            Participar Agora
          </Link>
        </div>
      </header>

      {/* STATS */}
      <section className="px-6 py-12 bg-white/5 border-y border-white/10">
        <div className="max-w-xl mx-auto grid grid-cols-2 gap-6">
          {[
            ["Participantes", data.stats.participants.toLocaleString("pt-BR")],
            ["Palpites Enviados", data.stats.predictions.toLocaleString("pt-BR")],
            ["Jogos Concluídos", data.stats.finished],
            ["Jogos Restantes", data.stats.remaining],
          ].map(([l, v]) => (
            <div key={l} className="space-y-1">
              <span className="text-slate-500 text-xs uppercase font-bold tracking-widest">{l}</span>
              <div className="text-3xl font-display">{v}</div>
            </div>
          ))}
        </div>
      </section>

      {/* RANKING */}
      <section className="px-6 py-16 max-w-xl mx-auto">
        <h2 className="font-display text-4xl mb-10 italic uppercase">Ranking Geral</h2>

        {podium.length === 0 ? (
          <p className="text-slate-500 text-center text-sm uppercase tracking-widest py-12">Aguardando primeiros palpiteiros...</p>
        ) : (
          <>
            <div className="flex items-end justify-center gap-2 mb-12 h-64">
              {[1,0,2].map((idx) => {
                const p = podium[idx];
                if (!p) return <div key={idx} className="flex-1" />;
                const place = idx + 1;
                const isFirst = place === 1;
                const isSecond = place === 2;
                const heightCls = isFirst ? "h-44" : isSecond ? "h-28" : "h-20";
                const colorCls = isFirst ? "bg-gold text-night" : isSecond ? "bg-slate-400/20 text-slate-300 border-t border-x border-slate-400/30" : "bg-amber-700/20 text-amber-600 border-t border-x border-amber-700/30";
                const ring = isFirst ? "border-4 border-gold size-20 shadow-[0_0_20px_rgba(250,204,21,0.3)]" : isSecond ? "border-2 border-slate-400 size-14" : "border-2 border-amber-700 size-14";
                return (
                  <div key={idx} className={`flex-1 flex flex-col items-center ${isFirst ? "-translate-y-4" : ""}`}>
                    <div className={`rounded-full p-0.5 mb-2 overflow-hidden ${ring}`}>
                      <div className="w-full h-full bg-slate-800 rounded-full grid place-items-center font-display text-2xl">
                        {p.nickname?.[0]?.toUpperCase() ?? "?"}
                      </div>
                    </div>
                    <div className={`w-full ${heightCls} rounded-t-lg flex flex-col items-center justify-center ${colorCls}`}>
                      <span className={`font-display ${isFirst ? "text-6xl" : "text-3xl"}`}>{place}º</span>
                      <span className="text-[10px] font-black uppercase truncate w-full px-2 text-center">{p.nickname}</span>
                      <span className="text-[10px] font-bold opacity-80">{p.total_points} pts</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="space-y-3">
              {rest.map((p, i) => (
                <div key={p.id} className="bg-white/5 p-4 flex items-center justify-between border-l-4 border-slate-500">
                  <div className="flex items-center gap-4">
                    <span className="font-display text-xl text-slate-500">{String(i+4).padStart(2,"0")}</span>
                    <span className="font-bold text-sm uppercase truncate">{p.nickname}</span>
                  </div>
                  <span className="font-display text-lg">{p.total_points} pts</span>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      {/* REGRAS E PONTUAÇÃO */}
      <section className="px-6 py-16 max-w-xl mx-auto">
        <h2 className="font-display text-4xl mb-10 italic uppercase">Regras e Pontuação</h2>

        <div className="space-y-8">
          {/* Fase de Grupo */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <Target className="w-6 h-6 text-grass" />
              <h3 className="font-display text-2xl uppercase">Fase de Grupo</h3>
            </div>
            <div className="space-y-3">
              {[
                ["Placar exato", "10 pts", "text-gold"],
                ["Acertou vencedor + um gol", "7 pts", "text-grass"],
                ["Acertou vencedor", "5 pts", "text-white"],
                ["Acertou empate", "5 pts", "text-white"],
                ["Acertou apenas um gol", "2 pts", "text-slate-400"],
                ["Errou tudo", "0 pts", "text-slate-500"],
              ].map(([label, pts, color]) => (
                <div key={label} className="flex items-center justify-between border-b border-white/5 pb-2 last:border-0 last:pb-0">
                  <span className="text-sm">{label}</span>
                  <span className={`font-display text-lg ${color}`}>{pts}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Mata-Mata */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <Trophy className="w-6 h-6 text-gold" />
              <h3 className="font-display text-2xl uppercase">Mata-Mata</h3>
            </div>
            <div className="space-y-3">
              {[
                ["Placar exato", "15 pts", "text-gold"],
                ["Vencedor + um gol", "11 pts", "text-gold"],
                ["Acertou vencedor", "8 pts", "text-grass"],
                ["Acertou um gol", "3 pts", "text-slate-400"],
                ["Errou tudo", "0 pts", "text-slate-500"],
              ].map(([label, pts, color]) => (
                <div key={label} className="flex items-center justify-between border-b border-white/5 pb-2 last:border-0 last:pb-0">
                  <span className="text-sm">{label}</span>
                  <span className={`font-display text-lg ${color}`}>{pts}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Torneio */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <Medal className="w-6 h-6 text-victory" />
              <h3 className="font-display text-2xl uppercase">Previsões do Torneio</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                ["Campeão", "30 pts"],
                ["Vice-campeão", "15 pts"],
                ["3º Lugar", "10 pts"],
                ["Finalista", "12 pts"],
                ["Semifinalista", "8 pts"],
                ["Quartas", "5 pts"],
                ["Oitavas", "3 pts"],
                ["1º / 2º Grupo", "5 pts"],
              ].map(([label, pts]) => (
                <div key={label} className="bg-white/5 rounded-lg p-3 text-center">
                  <span className="block text-xs uppercase text-slate-500 mb-1">{label}</span>
                  <span className="font-display text-xl text-gold">{pts}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* PAGAMENTO PIX */}
      <section className="px-6 py-16 max-w-xl mx-auto">
        <h2 className="font-display text-4xl mb-10 italic uppercase">Inscrição</h2>
        <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-6">
          <div className="flex items-center gap-4">
            <div className="bg-grass/10 p-3 rounded-lg">
              <DollarSign className="w-6 h-6 text-grass" />
            </div>
            <div>
              <span className="block text-xs uppercase text-slate-500 font-bold tracking-widest">Valor da inscrição</span>
              <span className="font-display text-3xl text-white">R$ 10,00</span>
            </div>
          </div>

          <div className="bg-night/50 border border-white/10 rounded-lg p-5 space-y-4">
            <div className="flex items-center gap-3">
              <Smartphone className="w-5 h-5 text-grass" />
              <div>
                <span className="block text-xs uppercase text-slate-500 font-bold tracking-widest">Chave Pix</span>
                <span className="font-mono text-lg text-white tracking-wider">19983972249</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <User className="w-5 h-5 text-grass" />
              <div>
                <span className="block text-xs uppercase text-slate-500 font-bold tracking-widest">Beneficiário</span>
                <span className="text-sm text-white">Einstein Hellmeister Soares</span>
              </div>
            </div>
          </div>

          <CopyPixButton />
        </div>
      </section>

      <footer className="px-6 pt-12 pb-20 max-w-xl mx-auto text-center">
        <div className="opacity-20 font-display text-4xl mb-4 italic">World Cup 2026</div>
        <p className="text-slate-600 text-[10px] uppercase tracking-tighter leading-relaxed">
          Plataforma de entretenimento. Jogue com responsabilidade.
        </p>
      </footer>
    </div>
  );
}
