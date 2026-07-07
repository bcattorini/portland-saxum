"use client";

import { useActionState } from "react";
import { login, type LoginState } from "@/app/auth/actions";

export default function LoginPage() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, null);

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-card p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand text-sm font-semibold text-white">
            PS
          </span>
          <div>
            <div className="font-semibold tracking-tight">Portland Saxum</div>
            <div className="text-xs text-neutral-400">Sistema de gestión</div>
          </div>
        </div>

        <form action={action} className="space-y-3">
          <label className="block text-xs text-neutral-500">
            Email
            <input
              name="email"
              type="email"
              autoComplete="username"
              required
              className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-brand"
            />
          </label>
          <label className="block text-xs text-neutral-500">
            Contraseña
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-brand"
            />
          </label>

          {state?.error && <div className="text-xs text-[#a32d2d]">{state.error}</div>}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-md bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-60"
          >
            {pending ? "Ingresando…" : "Ingresar"}
          </button>
        </form>
      </div>
    </div>
  );
}
