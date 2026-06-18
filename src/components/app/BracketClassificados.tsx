import { useMemo, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { CheckCircle2, ChevronsUpDown, X, Lock, Clock, Trophy, Medal } from "lucide-react";

export type Team = {
  id: string;
  name: string;
  sigla: string;
  flag: string;
  group_letter: string | null;
};

type Placeholder =
  | { kind: "group"; pos: "1" | "2"; g: string }
  | { kind: "third"; groups: string[] };

type R32Slot = { id: string; a: Placeholder; b: Placeholder };

// --- Bracket definition (from FIFA World Cup 2026 image) ---
export const R32_SLOTS: R32Slot[] = [
  // LEFT side (top → bottom)
  { id: "r32-1", a: { kind: "group", pos: "1", g: "E" }, b: { kind: "third", groups: ["A", "B", "C", "D", "F"] } },
  { id: "r32-2", a: { kind: "group", pos: "1", g: "I" }, b: { kind: "third", groups: ["C", "D", "F", "G", "H"] } },
  { id: "r32-3", a: { kind: "group", pos: "2", g: "A" }, b: { kind: "group", pos: "2", g: "B" } },
  { id: "r32-4", a: { kind: "group", pos: "1", g: "F" }, b: { kind: "group", pos: "2", g: "C" } },
  { id: "r32-5", a: { kind: "group", pos: "2", g: "K" }, b: { kind: "group", pos: "2", g: "L" } },
  { id: "r32-6", a: { kind: "group", pos: "1", g: "H" }, b: { kind: "group", pos: "2", g: "J" } },
  { id: "r32-7", a: { kind: "group", pos: "1", g: "D" }, b: { kind: "third", groups: ["B", "E", "F", "I", "J"] } },
  { id: "r32-8", a: { kind: "group", pos: "1", g: "G" }, b: { kind: "third", groups: ["A", "E", "H", "I", "J"] } },
  // RIGHT side
  { id: "r32-9", a: { kind: "group", pos: "1", g: "C" }, b: { kind: "group", pos: "2", g: "F" } },
  { id: "r32-10", a: { kind: "group", pos: "2", g: "E" }, b: { kind: "group", pos: "2", g: "I" } },
  { id: "r32-11", a: { kind: "group", pos: "1", g: "A" }, b: { kind: "third", groups: ["C", "E", "F", "H", "I"] } },
  { id: "r32-12", a: { kind: "group", pos: "1", g: "L" }, b: { kind: "third", groups: ["E", "H", "I", "J", "K"] } },
  { id: "r32-13", a: { kind: "group", pos: "1", g: "J" }, b: { kind: "group", pos: "2", g: "H" } },
  { id: "r32-14", a: { kind: "group", pos: "2", g: "D" }, b: { kind: "group", pos: "2", g: "G" } },
  { id: "r32-15", a: { kind: "group", pos: "1", g: "B" }, b: { kind: "third", groups: ["E", "F", "G", "I", "J"] } },
  { id: "r32-16", a: { kind: "group", pos: "1", g: "K" }, b: { kind: "third", groups: ["D", "E", "I", "J", "L"] } },
];

// Pairs collapsing each level
const R16_PAIRS = [
  ["r16-1", "r32-1", "r32-2"],
  ["r16-2", "r32-3", "r32-4"],
  ["r16-3", "r32-5", "r32-6"],
  ["r16-4", "r32-7", "r32-8"],
  ["r16-5", "r32-9", "r32-10"],
  ["r16-6", "r32-11", "r32-12"],
  ["r16-7", "r32-13", "r32-14"],
  ["r16-8", "r32-15", "r32-16"],
] as const;
const QF_PAIRS = [
  ["qf-1", "r16-1", "r16-2"],
  ["qf-2", "r16-3", "r16-4"],
  ["qf-3", "r16-5", "r16-6"],
  ["qf-4", "r16-7", "r16-8"],
] as const;
const SF_PAIRS = [
  ["sf-1", "qf-1", "qf-2"],
  ["sf-2", "qf-3", "qf-4"],
] as const;

function key(predType: string, slot: string | null) {
  return `${predType}|${slot ?? ""}`;
}

/**
 * Resolve which Team occupies the "a"/"b" placeholder of an R32 slot,
 * based on the user's group picks and (for third placeholders) the per-slot
 * "which group's third" choice stored under pred_type "r32" with the
 * synthetic suffix "-third-a" / "-third-b".
 */
function resolveR32Participants(
  slot: R32Slot,
  teams: Team[],
  values: Record<string, string>,
) {
  function placeholder(p: Placeholder, side: "a" | "b") {
    if (p.kind === "group") {
      const predType = p.pos === "1" ? "group_1st" : "group_2nd";
      const teamId = values[key(predType, p.g)];
      return {
        label: `${p.pos}º ${p.g}`,
        team: teams.find((t) => t.id === teamId) ?? null,
      };
    }
    // Storage: team_id of the chosen 3rd-placed team (matches DB uuid column).
    const teamId = values[key("r32", `${slot.id}-third-${side}`)] || "";
    let chosenGroup = "";
    if (teamId) {
      for (const g of ["A","B","C","D","E","F","G","H","I","J","K","L"]) {
        if (values[key("group_3rd", g)] === teamId) { chosenGroup = g; break; }
      }
    }
    return {
      label: `3º ${p.groups.join("/")}`,
      team: teams.find((t) => t.id === teamId) ?? null,
      thirdSlot: { side, allowed: p.groups, chosenGroup },
    };
  }
  return { a: placeholder(slot.a, "a"), b: placeholder(slot.b, "b") };
}

// Lookup helpers for derived bracket levels
type Side = { team: Team | null; label: string };
function getR16Participants(
  r16Id: string,
  teams: Team[],
  values: Record<string, string>,
): [Side, Side] {
  const pair = R16_PAIRS.find((p) => p[0] === r16Id)!;
  const sides = pair.slice(1).map((src) => {
    const winnerId = values[key("r32", src)] || "";
    return { team: teams.find((t) => t.id === winnerId) ?? null, label: `Vencedor ${src.toUpperCase()}` };
  });
  return [sides[0], sides[1]];
}
function getNextParticipants(
  pairs: ReadonlyArray<readonly [string, string, string]>,
  predTypePrev: string,
  targetId: string,
  teams: Team[],
  values: Record<string, string>,
): [Side, Side] {
  const pair = pairs.find((p) => p[0] === targetId)!;
  const sides = [pair[1], pair[2]].map((src) => {
    const winnerId = values[key(predTypePrev, src)] || "";
    return { team: teams.find((t) => t.id === winnerId) ?? null, label: `Vencedor ${src.toUpperCase()}` };
  });
  return [sides[0], sides[1]];
}

// Phases user can navigate through
const PHASES = [
  { id: "groups", label: "Grupos" },
  { id: "r32", label: "16 avos" },
  { id: "r16", label: "Oitavas" },
  { id: "qf", label: "Quartas" },
  { id: "sf", label: "Semifinal" },
  { id: "third", label: "3º Lugar" },
  { id: "final", label: "Final" },
] as const;
type PhaseId = (typeof PHASES)[number]["id"];

export function BracketClassificados({
  teams,
  values,
  setValue,
  locked,
  deadline,
}: {
  teams: Team[];
  values: Record<string, string>;
  setValue: (k: string, v: string) => void;
  locked: boolean;
  deadline: Date;
}) {
  const [phase, setPhase] = useState<PhaseId>("groups");
  const groups = useMemo(
    () => Array.from(new Set(teams.map((t) => t.group_letter).filter(Boolean))).sort() as string[],
    [teams],
  );

  // Cascade clear: when a parent pick changes, wipe downstream
  function cascadeClear(changedKeys: string[]) {
    // Build dependency map: any change in r32 winners invalidates the corresponding r16+; etc.
    const next: Record<string, string> = { ...values };
    let dirty = true;
    while (dirty) {
      dirty = false;
      // If an R16 winner refers to a team not in current r32 winners, clear it
      for (const [r16Id] of R16_PAIRS) {
        const wid = next[key("r16", r16Id)];
        if (!wid) continue;
        const [a, b] = getR16Participants(r16Id, teams, next);
        if (a.team?.id !== wid && b.team?.id !== wid) {
          next[key("r16", r16Id)] = "";
          dirty = true;
        }
      }
      for (const [qfId] of QF_PAIRS) {
        const wid = next[key("qf", qfId)];
        if (!wid) continue;
        const [a, b] = getNextParticipants(QF_PAIRS, "r16", qfId, teams, next);
        if (a.team?.id !== wid && b.team?.id !== wid) {
          next[key("qf", qfId)] = "";
          dirty = true;
        }
      }
      for (const [sfId] of SF_PAIRS) {
        const wid = next[key("sf", sfId)];
        if (!wid) continue;
        const [a, b] = getNextParticipants(SF_PAIRS, "qf", sfId, teams, next);
        if (a.team?.id !== wid && b.team?.id !== wid) {
          next[key("sf", sfId)] = "";
          dirty = true;
        }
      }
      // Final / 3rd
      const sf1 = next[key("sf", "sf-1")];
      const sf2 = next[key("sf", "sf-2")];
      const finalists = [sf1, sf2].filter(Boolean);
      const champId = next[key("champion", "")];
      if (champId && !finalists.includes(champId)) {
        next[key("champion", "")] = "";
        dirty = true;
      }
      // Bronze winners must be loser of SF
      const [sf1a, sf1b] = getNextParticipants(SF_PAIRS, "qf", "sf-1", teams, next);
      const [sf2a, sf2b] = getNextParticipants(SF_PAIRS, "qf", "sf-2", teams, next);
      const losersAllowed = new Set<string>();
      if (sf1) {
        if (sf1a.team && sf1a.team.id !== sf1) losersAllowed.add(sf1a.team.id);
        if (sf1b.team && sf1b.team.id !== sf1) losersAllowed.add(sf1b.team.id);
      }
      if (sf2) {
        if (sf2a.team && sf2a.team.id !== sf2) losersAllowed.add(sf2a.team.id);
        if (sf2b.team && sf2b.team.id !== sf2) losersAllowed.add(sf2b.team.id);
      }
      const thirdId = next[key("third", "")];
      if (thirdId && !losersAllowed.has(thirdId)) {
        next[key("third", "")] = "";
        dirty = true;
      }
    }
    // Apply diff
    for (const k of Object.keys(next)) {
      if (next[k] !== values[k]) setValue(k, next[k]);
    }
    // Touch the keys actually changed first
    for (const k of changedKeys) {
      // already applied via parent setValue call
      void k;
    }
  }

  function update(k: string, v: string) {
    setValue(k, v);
    // Schedule cascade on next tick to read updated values
    queueMicrotask(() => cascadeClear([k]));
  }

  return (
    <div className="space-y-6">
      {locked ? (
        <div className="bg-victory/10 border border-victory/30 p-3 text-xs text-slate-300 flex items-center gap-2">
          <Lock className="size-4 text-victory" /> Palpites de classificação bloqueados (encerrado em{" "}
          {deadline.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}).
        </div>
      ) : (
        <div className="bg-grass/10 border border-grass/30 p-3 text-xs text-slate-300 flex items-center gap-2">
          <Clock className="size-4 text-grass" /> Edite até{" "}
          {deadline.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}.
          Alterar uma fase anterior limpa automaticamente as próximas.
        </div>
      )}

      {/* Phase tabs */}
      <div className="flex flex-wrap gap-2">
        {PHASES.map((p) => (
          <button
            key={p.id}
            onClick={() => setPhase(p.id)}
            className={cn(
              "px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest border",
              phase === p.id
                ? "bg-grass text-night border-grass"
                : "border-white/10 text-slate-400 hover:text-white",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {phase === "groups" && (
        <GroupsPhase teams={teams} groups={groups} values={values} update={update} locked={locked} />
      )}
      {phase === "r32" && (
        <R32Phase teams={teams} values={values} update={update} locked={locked} />
      )}
      {phase === "r16" && (
        <BracketLevel
          title="Oitavas de Final"
          slots={R16_PAIRS.map((p) => p[0])}
          predType="r16"
          getSides={(id) => getR16Participants(id, teams, values)}
          values={values}
          update={update}
          locked={locked}
        />
      )}
      {phase === "qf" && (
        <BracketLevel
          title="Quartas de Final"
          slots={QF_PAIRS.map((p) => p[0])}
          predType="qf"
          getSides={(id) => getNextParticipants(QF_PAIRS, "r16", id, teams, values)}
          values={values}
          update={update}
          locked={locked}
        />
      )}
      {phase === "sf" && (
        <BracketLevel
          title="Semifinais"
          slots={SF_PAIRS.map((p) => p[0])}
          predType="sf"
          getSides={(id) => getNextParticipants(SF_PAIRS, "qf", id, teams, values)}
          values={values}
          update={update}
          locked={locked}
        />
      )}
      {phase === "third" && (
        <ThirdPlacePhase teams={teams} values={values} update={update} locked={locked} />
      )}
      {phase === "final" && (
        <FinalPhase teams={teams} values={values} update={update} locked={locked} />
      )}
    </div>
  );
}

// =====================================================
// Generic primitives
// =====================================================

function TeamPick({
  value,
  onChange,
  options,
  placeholder = "Selecione",
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Team[];
  placeholder?: string;
  disabled?: boolean;
}) {
  const selected = options.find((t) => t.id === value) ?? null;
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "flex w-full items-center justify-between gap-2 bg-white/5 border border-white/10 px-3 py-2.5 text-left text-sm disabled:opacity-60",
            !selected && "text-slate-500",
          )}
        >
          {selected ? (
            <span className="inline-flex items-center gap-2 min-w-0">
              {selected.flag && <span className="text-lg leading-none shrink-0">{selected.flag}</span>}
              <span className="truncate font-bold uppercase tracking-tight text-xs">{selected.name}</span>
            </span>
          ) : (
            <span className="text-xs uppercase tracking-widest">{placeholder}</span>
          )}
          {selected && !disabled ? (
            <X
              className="ml-auto size-4 shrink-0 opacity-60 hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
              }}
            />
          ) : (
            <ChevronsUpDown className="ml-auto size-4 shrink-0 opacity-60" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[260px] sm:w-[300px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar..." className="h-10" />
          <CommandList className="max-h-[260px]">
            <CommandEmpty>Nenhum disponível.</CommandEmpty>
            <CommandGroup>
              {options.map((t) => (
                <CommandItem
                  key={t.id}
                  value={`${t.name} ${t.sigla}`}
                  onSelect={() => {
                    onChange(t.id);
                    setOpen(false);
                  }}
                  className="flex items-center gap-2"
                >
                  {t.flag && <span className="text-lg leading-none shrink-0">{t.flag}</span>}
                  <span className="font-bold uppercase tracking-tight text-xs">{t.name}</span>
                  {value === t.id && <CheckCircle2 className="ml-auto size-4 text-grass shrink-0" />}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function WinnerCard({
  title,
  hint,
  a,
  b,
  winnerId,
  onPickWinner,
  disabled,
  children,
}: {
  title: string;
  hint?: string;
  a: { team: Team | null; label: string };
  b: { team: Team | null; label: string };
  winnerId: string;
  onPickWinner: (v: string) => void;
  disabled?: boolean;
  children?: React.ReactNode;
}) {
  const winnerOptions = [a.team, b.team].filter(Boolean) as Team[];
  return (
    <div className="bg-white/5 border border-white/10 p-3 space-y-2">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-slate-500">
        <span>{title}</span>
        {hint && <span className="text-slate-600">{hint}</span>}
      </div>
      {children}
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
        <SideTeam side={a} />
        <span className="text-slate-500 font-display text-lg">×</span>
        <SideTeam side={b} />
      </div>
      <div className="pt-2 border-t border-white/5">
        <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">Vencedor</div>
        <TeamPick
          value={winnerId}
          onChange={onPickWinner}
          options={winnerOptions}
          placeholder={winnerOptions.length < 2 ? "Aguardando confrontos" : "Escolha o vencedor"}
          disabled={disabled || winnerOptions.length === 0}
        />
      </div>
    </div>
  );
}

function SideTeam({ side }: { side: { team: Team | null; label: string } }) {
  if (!side.team) {
    return (
      <div className="text-[10px] uppercase tracking-widest text-slate-500 px-2 py-2 border border-dashed border-white/10">
        {side.label}
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 min-w-0 px-2 py-2 border border-white/10">
      <span className="text-lg shrink-0">{side.team.flag}</span>
      <span className="truncate font-bold uppercase tracking-tight text-xs">{side.team.name}</span>
    </div>
  );
}

// =====================================================
// Phases
// =====================================================

function GroupsPhase({
  teams,
  groups,
  values,
  update,
  locked,
}: {
  teams: Team[];
  groups: string[];
  values: Record<string, string>;
  update: (k: string, v: string) => void;
  locked: boolean;
}) {
  return (
    <div>
      <h3 className="text-xs uppercase tracking-widest text-slate-500 mb-3">
        Classificados de cada grupo (1º, 2º e 3º lugar)
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {groups.map((g) => {
          const groupTeams = teams.filter((t) => t.group_letter === g);
          const v1 = values[key("group_1st", g)] || "";
          const v2 = values[key("group_2nd", g)] || "";
          const v3 = values[key("group_3rd", g)] || "";
          const remaining = (excluded: string[]) =>
            groupTeams.filter((t) => !excluded.includes(t.id));
          return (
            <div key={g} className="bg-white/5 border border-white/10 p-3 space-y-2">
              <div className="font-display text-xl">Grupo {g}</div>
              {(
                [
                  ["1º colocado", "group_1st", v1, [v2, v3]],
                  ["2º colocado", "group_2nd", v2, [v1, v3]],
                  ["3º colocado", "group_3rd", v3, [v1, v2]],
                ] as const
              ).map(([label, pt, val, excl]) => (
                <div key={pt}>
                  <label className="text-[10px] uppercase tracking-widest text-slate-500">
                    {label}
                  </label>
                  <TeamPick
                    value={val}
                    onChange={(v) => update(key(pt, g), v)}
                    options={remaining(excl.filter(Boolean))}
                    disabled={locked}
                    placeholder="Selecione um país"
                  />
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function R32Phase({
  teams,
  values,
  update,
  locked,
}: {
  teams: Team[];
  values: Record<string, string>;
  update: (k: string, v: string) => void;
  locked: boolean;
}) {
  return (
    <div className="space-y-4">
      <h3 className="text-xs uppercase tracking-widest text-slate-500">16 avos de Final</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {R32_SLOTS.map((slot, i) => {
          const sides = resolveR32Participants(slot, teams, values);
          const winnerId = values[key("r32", slot.id)] || "";
          return (
            <WinnerCard
              key={slot.id}
              title={`Jogo ${i + 1}`}
              hint={slot.id.toUpperCase()}
              a={sides.a}
              b={sides.b}
              winnerId={winnerId}
              onPickWinner={(v) => update(key("r32", slot.id), v)}
              disabled={locked}
            >
              {/* Third-placeholder group selectors */}
              {(slot.a.kind === "third" || slot.b.kind === "third") && (
                <div className="grid grid-cols-2 gap-2">
                  {(["a", "b"] as const).map((side) => {
                    const p = side === "a" ? slot.a : slot.b;
                    if (p.kind !== "third") return <div key={side} />;
                    const chosen = values[key("r32", `${slot.id}-third-${side}`)] || "";
                    return (
                      <div key={side}>
                        <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">
                          3º de qual grupo? ({p.groups.join("/")})
                        </div>
                        <select
                          value={chosen}
                          onChange={(e) => update(key("r32", `${slot.id}-third-${side}`), e.target.value)}
                          disabled={locked}
                          className="w-full bg-white/5 border border-white/10 px-2 py-2 text-xs uppercase font-bold disabled:opacity-60"
                        >
                          <option value="">—</option>
                          {p.groups.map((g) => (
                            <option key={g} value={g}>
                              Grupo {g}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>
              )}
            </WinnerCard>
          );
        })}
      </div>
    </div>
  );
}

function BracketLevel({
  title,
  slots,
  predType,
  getSides,
  values,
  update,
  locked,
}: {
  title: string;
  slots: string[];
  predType: string;
  getSides: (id: string) => [Side, Side];
  values: Record<string, string>;
  update: (k: string, v: string) => void;
  locked: boolean;
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-xs uppercase tracking-widest text-slate-500">{title}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {slots.map((id, i) => {
          const [a, b] = getSides(id);
          const winnerId = values[key(predType, id)] || "";
          return (
            <WinnerCard
              key={id}
              title={`Jogo ${i + 1}`}
              hint={id.toUpperCase()}
              a={a}
              b={b}
              winnerId={winnerId}
              onPickWinner={(v) => update(key(predType, id), v)}
              disabled={locked}
            />
          );
        })}
      </div>
    </div>
  );
}

function ThirdPlacePhase({
  teams,
  values,
  update,
  locked,
}: {
  teams: Team[];
  values: Record<string, string>;
  update: (k: string, v: string) => void;
  locked: boolean;
}) {
  const [sf1a, sf1b] = getNextParticipants(SF_PAIRS, "qf", "sf-1", teams, values);
  const [sf2a, sf2b] = getNextParticipants(SF_PAIRS, "qf", "sf-2", teams, values);
  const sf1W = values[key("sf", "sf-1")];
  const sf2W = values[key("sf", "sf-2")];
  const sf1Loser: Side =
    sf1W && sf1a.team && sf1b.team
      ? sf1W === sf1a.team.id
        ? { team: sf1b.team, label: "Perdedor SF1" }
        : { team: sf1a.team, label: "Perdedor SF1" }
      : { team: null, label: "Perdedor SF1" };
  const sf2Loser: Side =
    sf2W && sf2a.team && sf2b.team
      ? sf2W === sf2a.team.id
        ? { team: sf2b.team, label: "Perdedor SF2" }
        : { team: sf2a.team, label: "Perdedor SF2" }
      : { team: null, label: "Perdedor SF2" };

  const thirdId = values[key("third", "")] || "";
  return (
    <div className="space-y-3">
      <h3 className="text-xs uppercase tracking-widest text-slate-500 flex items-center gap-2">
        <Medal className="size-4 text-gold" /> Disputa de 3º Lugar
      </h3>
      <p className="text-xs text-slate-400">
        Os participantes são automaticamente os perdedores das semifinais.
      </p>
      <WinnerCard
        title="Bronze"
        a={sf1Loser}
        b={sf2Loser}
        winnerId={thirdId}
        onPickWinner={(v) => update(key("third", ""), v)}
        disabled={locked}
      />
    </div>
  );
}

function FinalPhase({
  teams,
  values,
  update,
  locked,
}: {
  teams: Team[];
  values: Record<string, string>;
  update: (k: string, v: string) => void;
  locked: boolean;
}) {
  const sf1W = values[key("sf", "sf-1")];
  const sf2W = values[key("sf", "sf-2")];
  const fA: Side = {
    team: teams.find((t) => t.id === sf1W) ?? null,
    label: "Vencedor SF1",
  };
  const fB: Side = {
    team: teams.find((t) => t.id === sf2W) ?? null,
    label: "Vencedor SF2",
  };
  const champId = values[key("champion", "")] || "";
  return (
    <div className="space-y-3">
      <h3 className="text-xs uppercase tracking-widest text-slate-500 flex items-center gap-2">
        <Trophy className="size-4 text-gold" /> Grande Final
      </h3>
      <WinnerCard
        title="Final"
        a={fA}
        b={fB}
        winnerId={champId}
        onPickWinner={(v) => update(key("champion", ""), v)}
        disabled={locked}
      />
      {champId && (fA.team?.id === champId || fB.team?.id === champId) && (
        <div className="bg-gold/10 border border-gold/30 p-3 text-xs text-slate-300 flex items-center gap-2">
          <Trophy className="size-4 text-gold" /> Vice-campeão automático:{" "}
          <b className="text-white">
            {(fA.team?.id === champId ? fB.team?.name : fA.team?.name) ?? "—"}
          </b>
        </div>
      )}
    </div>
  );
}