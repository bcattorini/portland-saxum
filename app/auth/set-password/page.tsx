"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) { setError("La contraseña debe tener al menos 8 caracteres."); return; }
    if (password !== confirm) { setError("Las contraseñas no coinciden."); return; }
    setBusy(true); setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) { setError("No se pudo guardar. El link pudo haber vencido; pedí uno nuevo. (" + error.message + ")"); return; }
    setDone(true);
    setTimeout(() => router.replace("/permisos"), 1200);
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-card p-8 shadow-sm">
        <div className="mb-6">
          <div className="flex justify-center rounded-xl bg-brand px-6 py-5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-white.png" alt="Portland Saxum" className="h-9 w-auto" />
          </div>
          <div className="mt-3 text-center text-xs text-neutral-400">Elegí tu contraseña</div>
        </div>

        {done ? (
          <div className="text-center text-sm text-[#3b6d11]">✓ Listo. Entrando…</div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <label className="block text-xs text-neutral-500">
              Nueva contraseña
              <input
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-brand"
              />
            </label>
            <label className="block text-xs text-neutral-500">
              Repetir contraseña
              <input
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-brand"
              />
            </label>

            {error && <div className="text-xs text-[#a32d2d]">{error}</div>}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-md bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-60"
            >
              {busy ? "Guardando…" : "Guardar contraseña"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
