import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trophy } from "lucide-react";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

type Mode = "login" | "signup" | "reset";

function AuthPage() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [nickname, setNickname] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Bem-vindo de volta!");
        navigate({ to: "/dashboard" });
      } else if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: { full_name: fullName, nickname },
          },
        });
        if (error) throw error;
        toast.success("Conta criada! Verifique seu email se necessário.");
        navigate({ to: "/dashboard" });
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("Email de recuperação enviado.");
        setMode("login");
      }
    } catch (err: any) {
      toast.error(err.message ?? "Erro");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-night text-white flex flex-col">
      <div className="p-6">
        <Link to="/" className="inline-flex items-center gap-2 text-slate-400 hover:text-white">
          <Trophy className="size-4 text-grass" />
          <span className="font-display text-xl uppercase italic tracking-tighter">Bolão 26</span>
        </Link>
      </div>
      <div className="flex-1 flex items-center justify-center px-6 pb-12">
        <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4">
          <h1 className="font-display text-5xl uppercase italic tracking-tighter mb-6">
            {mode === "login" ? "Entrar" : mode === "signup" ? "Cadastrar" : "Recuperar"}
          </h1>

          {mode === "signup" && (
            <>
              <input className="w-full bg-white/5 border border-white/10 px-4 py-3 outline-none focus:border-grass" placeholder="Nome completo" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              <input className="w-full bg-white/5 border border-white/10 px-4 py-3 outline-none focus:border-grass" placeholder="Apelido" value={nickname} onChange={(e) => setNickname(e.target.value)} required />
            </>
          )}
          <input type="email" className="w-full bg-white/5 border border-white/10 px-4 py-3 outline-none focus:border-grass" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} required />
          {mode !== "reset" && (
            <input type="password" className="w-full bg-white/5 border border-white/10 px-4 py-3 outline-none focus:border-grass" placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          )}

          <button type="submit" disabled={loading} className="w-full bg-grass text-night font-black uppercase py-4 tracking-tighter disabled:opacity-50">
            {loading ? "Aguarde..." : mode === "login" ? "Entrar" : mode === "signup" ? "Criar Conta" : "Enviar Email"}
          </button>

          <div className="text-center text-xs text-slate-500 uppercase tracking-widest space-y-2 pt-4">
            {mode === "login" && (
              <>
                <button type="button" onClick={() => setMode("signup")} className="block w-full hover:text-white">Não tenho conta &rarr; Cadastrar</button>
                <button type="button" onClick={() => setMode("reset")} className="block w-full hover:text-white">Esqueci minha senha</button>
              </>
            )}
            {mode !== "login" && (
              <button type="button" onClick={() => setMode("login")} className="block w-full hover:text-white">&larr; Voltar ao login</button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}