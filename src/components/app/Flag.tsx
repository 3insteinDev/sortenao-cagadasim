export function Flag({
  flag,
  name,
  sigla,
  showName = false,
  className = "",
}: {
  flag?: string | null;
  name?: string | null;
  sigla?: string | null;
  showName?: boolean;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-1.5 min-w-0 ${className}`}>
      {flag ? <span className="text-xl leading-none shrink-0">{flag}</span> : null}
      <span className="flex flex-col min-w-0">
        <span className="font-bold uppercase tracking-tight text-xs leading-tight">
          {sigla ?? name ?? "TBD"}
        </span>
        {showName && name && sigla && name !== sigla ? (
          <span className="text-[10px] text-slate-400 truncate leading-tight">{name}</span>
        ) : null}
      </span>
    </span>
  );
}