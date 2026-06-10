export function Flag({ flag, name, sigla, className = "" }: { flag?: string | null; name?: string | null; sigla?: string | null; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span className="text-base leading-none">{flag ?? "🏳️"}</span>
      <span className="font-bold uppercase tracking-tight text-xs">{sigla ?? name ?? "TBD"}</span>
    </span>
  );
}