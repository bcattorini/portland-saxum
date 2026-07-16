"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { PaymentStatusBadge } from "@/lib/badges";

export type PendingItem = {
  id: string;
  source: string; // property address or "General"
  description: string;
  amount: number;
  currency: string;
  due_date: string | null;
  status: "Pending" | "Overdue";
  payment_type: "vendor" | "client";
  quickbooks_code: string | null;
  href: string;
};

const money = (n: number, c = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: c }).format(n);

type EstadoF = "all" | "overdue" | "upcoming";
type TipoF = "all" | "vendor" | "client";

export function PendingPaymentsCard({ items }: { items: PendingItem[] }) {
  const [open, setOpen] = useState(false);
  const [estado, setEstado] = useState<EstadoF>("all");
  const [tipo, setTipo] = useState<TipoF>("all");
  const [origen, setOrigen] = useState<string>("all");
  const today = new Date().toISOString().slice(0, 10);

  const isOverdue = (i: PendingItem) => i.status === "Overdue" || (i.due_date != null && i.due_date < today);
  const origins = [...new Set(items.map((i) => i.source))].sort((a, b) =>
    a === "General" ? -1 : b === "General" ? 1 : a.localeCompare(b),
  );
  const filtered = items.filter(
    (i) =>
      (estado === "all" || (estado === "overdue" ? isOverdue(i) : !isOverdue(i))) &&
      (tipo === "all" || i.payment_type === tipo) &&
      (origen === "all" || i.source === origen),
  );
  const total = filtered.reduce((s, i) => s + Number(i.amount || 0), 0);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-xl border border-line bg-card p-4 text-left transition-all hover:border-neutral-300 hover:shadow-sm"
      >
        <div className="text-3xl font-semibold text-brand">{items.length}</div>
        <div className="mt-2 text-sm font-medium">Pagos pendientes</div>
        <div className="text-xs text-neutral-400">ver todos →</div>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
          <div className="relative flex max-h-[80vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-card shadow-xl">
            <div className="flex items-center justify-between border-b border-line px-5 py-3">
              <div className="font-semibold">Pagos pendientes ({filtered.length})</div>
              <button
                onClick={() => setOpen(false)}
                className="rounded p-1 text-neutral-400 hover:bg-page hover:text-neutral-700"
                aria-label="Cerrar"
              >
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                </svg>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-5 py-2.5">
              <FilterGroup label="Estado" value={estado} onChange={(v) => setEstado(v as EstadoF)}
                options={[["all", "Todos"], ["overdue", "Vencidos"], ["upcoming", "Por vencer"]]} />
              <FilterGroup label="Tipo" value={tipo} onChange={(v) => setTipo(v as TipoF)}
                options={[["all", "Todos"], ["vendor", "Proveedor"], ["client", "Cliente"]]} />
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-medium uppercase tracking-wide text-neutral-400">Origen</span>
                <select
                  value={origen}
                  onChange={(e) => setOrigen(e.target.value)}
                  className="max-w-40 rounded-md border border-line bg-card px-2 py-1 text-xs outline-none focus:border-brand"
                >
                  <option value="all">Todos</option>
                  {origins.map((o) => (<option key={o} value={o}>{o}</option>))}
                </select>
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-neutral-500">
                {items.length === 0 ? "No hay pagos pendientes. 🎉" : "Ningún pago coincide con los filtros."}
              </div>
            ) : (
              <div className="overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-page text-left text-[11px] uppercase tracking-wide text-neutral-400">
                    <tr>
                      <th className="px-4 py-2 font-medium">Origen</th>
                      <th className="px-4 py-2 font-medium">Descripción</th>
                      <th className="px-4 py-2 text-right font-medium">Monto</th>
                      <th className="px-4 py-2 font-medium">Vence</th>
                      <th className="px-4 py-2 font-medium">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((p) => {
                      const overdue = isOverdue(p);
                      return (
                        <tr key={p.id} className="border-t border-line hover:bg-page/50">
                          <td className="px-4 py-2 align-top">
                            <Link href={p.href} onClick={() => setOpen(false)} className="font-medium text-brand hover:underline">
                              {p.source}
                            </Link>
                          </td>
                          <td className="px-4 py-2 align-top">
                            <div>{p.description}</div>
                            {p.quickbooks_code && (
                              <div className="font-mono text-[11px] text-neutral-400">{p.quickbooks_code}</div>
                            )}
                          </td>
                          <td className="px-4 py-2 text-right align-top font-mono">{money(Number(p.amount), p.currency)}</td>
                          <td className={clsx("px-4 py-2 align-top", overdue ? "font-medium text-[#a32d2d]" : "text-neutral-500")}>
                            {p.due_date ?? "—"}
                          </td>
                          <td className="px-4 py-2 align-top"><PaymentStatusBadge status={p.status} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="sticky bottom-0 border-t border-line bg-page/90">
                      <td colSpan={2} className="px-4 py-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
                        Total pendiente
                      </td>
                      <td className="px-4 py-2 text-right font-mono font-semibold text-[#a32d2d]">{money(total)}</td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function FilterGroup({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[11px] font-medium uppercase tracking-wide text-neutral-400">{label}</span>
      <div className="inline-flex rounded-md border border-line p-0.5">
        {options.map(([v, lbl]) => (
          <button
            key={v}
            onClick={() => onChange(v)}
            className={clsx(
              "rounded px-2 py-0.5 text-xs font-medium transition-colors",
              value === v ? "bg-brand text-white" : "text-neutral-500 hover:text-neutral-800",
            )}
          >
            {lbl}
          </button>
        ))}
      </div>
    </div>
  );
}
