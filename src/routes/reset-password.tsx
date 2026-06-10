import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({ component: ResetPage });

function ResetPage() {
  const [pw, setPw] = useState("");
  const navigate = useNavigate();
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) return toast.error(error.message);
    toast.success("Senha atualizada");
    navigate({ to: "/dashboard" });
  }
  return (
    <div className="min-h-screen bg-night text-white flex items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4">
        <h1 className="font-display text-4xl uppercase italic">Nova senha</h1>
        <input type="password" required minLength={6} value={pw} onChange={(e) => setPw(e.target.value)} className="w-full bg-white/5 border border-white/10 px-4 py-3" placeholder="Nova senha" />
        <button className="w-full bg-grass text-night font-black uppercase py-4 tracking-tighter">Salvar</button>
      </form>
    </div>
  );
}