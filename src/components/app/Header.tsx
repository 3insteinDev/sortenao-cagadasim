import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Trophy, LogOut, User as UserIcon, Menu, X } from "lucide-react";

export function Header() {
  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      setUserId(data.user?.id ?? null);
      if (data.user) {
        const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
        setIsAdmin(!!roles?.some((r) => r.role === "admin"));
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setUserId(s?.user?.id ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const links = userId
    ? [
        { to: "/dashboard", label: "Dashboard" },
        { to: "/palpites", label: "Meus Palpites" },
        { to: "/ranking", label: "Ranking" },
        { to: "/perfil", label: "Perfil" },
        ...(isAdmin ? [{ to: "/admin", label: "Admin" }] : []),
      ]
    : [{ to: "/", label: "Início" }];

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-night/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-2">
          <Trophy className="size-5 text-grass" />
          <span className="font-display text-2xl uppercase italic tracking-tighter">Bolão <span className="text-grass">26</span></span>
        </Link>
        <nav className="hidden md:flex items-center gap-1">
          {links.map((l) => (
            <Link key={l.to} to={l.to} className="px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-white transition-colors"
              activeProps={{ className: "px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-grass" }}>
              {l.label}
            </Link>
          ))}
          {userId ? (
            <button onClick={signOut} className="ml-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-victory">
              <LogOut className="size-3.5" /> Sair
            </button>
          ) : (
            <Link to="/auth" className="ml-2 bg-grass text-night px-4 py-2 font-black uppercase text-xs tracking-tighter hover:brightness-110">Entrar</Link>
          )}
        </nav>
        <button className="md:hidden text-white" onClick={() => setOpen(!open)} aria-label="menu">
          {open ? <X /> : <Menu />}
        </button>
      </div>
      {open && (
        <div className="md:hidden border-t border-border bg-night px-4 py-3 flex flex-col gap-2">
          {links.map((l) => (
            <Link key={l.to} to={l.to} onClick={() => setOpen(false)} className="py-2 text-sm font-bold uppercase tracking-widest text-slate-300">
              {l.label}
            </Link>
          ))}
          {userId ? (
            <button onClick={signOut} className="py-2 text-left text-sm font-bold uppercase tracking-widest text-victory">Sair</button>
          ) : (
            <Link to="/auth" onClick={() => setOpen(false)} className="bg-grass text-night py-3 text-center font-black uppercase tracking-tighter">Entrar</Link>
          )}
        </div>
      )}
    </header>
  );
}