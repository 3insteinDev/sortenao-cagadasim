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
  const displayName = name ?? sigla ?? "TBD";
  const displaySigla = sigla ?? name ?? "TBD";
  return (
    <span className={`inline-flex items-center gap-1.5 min-w-0 ${className}`}>
      {flag ? <span className="flag-emoji text-xl leading-none shrink-0">{flag}</span> : null}
      {showName ? (
        <>
          <span className="font-bold uppercase tracking-tight text-xs leading-tight truncate sm:hidden">
            {displaySigla}
          </span>
          <span className="hidden sm:inline font-bold uppercase tracking-tight text-xs leading-tight truncate">
            {displayName}
          </span>
        </>
      ) : (
        <span className="font-bold uppercase tracking-tight text-xs leading-tight truncate">
          {displaySigla}
        </span>
      )}
    </span>
  );
}