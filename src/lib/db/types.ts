export type Phase = "group" | "r32" | "r16" | "qf" | "sf" | "third" | "final";
export type MatchStatus = "scheduled" | "live" | "finished";

export const PHASE_LABEL: Record<Phase, string> = {
  group: "Fase de Grupos",
  r32: "16-avos",
  r16: "Oitavas",
  qf: "Quartas",
  sf: "Semifinal",
  third: "Terceiro Lugar",
  final: "Final",
};

export const PHASE_ORDER: Phase[] = ["group","r32","r16","qf","sf","third","final"];