"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Payment, PaymentStatus, PaymentType } from "@/lib/types";
import { PAYMENT_STATUSES } from "@/lib/types";
import { PaymentStatusBadge, PaymentTypeBadge } from "@/lib/badges";

const money = (n: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);

type Draft = {
  description: string;
  payment_type: PaymentType;
  vendor_or_payer: string;
  amount: string;
  due_date: string;
  status: PaymentStatus;
  quickbooks_code: string;
  notes: string;
};

const emptyDraft: Draft = {
  description: "",
  payment_type: "vendor",
  vendor_or_payer: "",
  amount: "",
  due_date: "",
  status: "Pending",
  quickbooks_code: "",
  notes: "",
};

const toDraft = (p: Payment): Draft => ({
  description: p.description,
  payment_type: p.payment_type,
  vendor_or_payer: p.vendor_or_payer ?? "",
  amount: String(p.amount ?? ""),
  due_date: p.due_date ?? "",
  status: p.status,
  quickbooks_code: p.quickbooks_code ?? "",
  notes: p.notes ?? "",
});

const draftToRow = (dr: Draft) => ({
  description: dr.description.trim(),
  payment_type: dr.payment_type,
  vendor_or_payer: dr.vendor_or_payer.trim() || null,
  amount: Number(dr.amount) || 0,
  due_date: dr.due_date || null,
  status: dr.status,
  quickbooks_code: dr.quickbooks_code.trim() || null,
  notes: dr.notes.trim() || null,
});

export function PagosTab({ propertyId }: { propertyId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .eq("property_id", propertyId)
        .order("sort_order", { nullsFirst: false })
        .order("created_at");
      if (cancelled) return;
      if (error) setError(error.message);
      else setRows((data ?? []) as Payment[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [propertyId, supabase]);

  async function addPayment(dr: Draft) {
    const nextSort = (rows.reduce((m, r) => Math.max(m, r.sort_order ?? 0), 0) || 0) + 1;
    const { data, error } = await supabase
      .from("payments")
      .insert({ property_id: propertyId, sort_order: nextSort, ...draftToRow(dr) })
      .select()
      .single();
    if (error) return error.message;
    setRows((prev) => [...prev, data as Payment]);
    setAdding(false);
    return null;
  }

  async function saveEdit(id: string, dr: Draft) {
    const { data, error } = await supabase
      .from("payments")
      .update(draftToRow(dr))
      .eq("id", id)
      .select()
      .single();
    if (error) return error.message;
    setRows((prev) => prev.map((r) => (r.id === id ? (data as Payment) : r)));
    setEditingId(null);
    return null;
  }

  async function markPaid(p: Payment) {
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from("payments")
      .update({ status: "Paid", paid_date: today })
      .eq("id", p.id)
      .select()
      .single();
    if (!error && data) setRows((prev) => prev.map((r) => (r.id === p.id ? (data as Payment) : r)));
  }

  async function remove(id: string) {
    const { error } = await supabase.from("payments").delete().eq("id", id);
    if (!error) setRows((prev) => prev.filter((r) => r.id !== id));
  }

  const pendingTotal = rows
    .filter((r) => r.status === "Pending" || r.status === "Overdue")
    .reduce((s, r) => s + Number(r.amount || 0), 0);

  if (loading) return <div className="py-8 text-center text-sm text-neutral-400">Cargando…</div>;
  if (error) return <div className="py-4 text-sm text-[#a32d2d]">Error: {error}</div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-neutral-500">{rows.length} pagos</span>
        <button
          onClick={() => setAdding((v) => !v)}
          className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-hover"
        >
          {adding ? "Cancelar" : "+ Agregar pago"}
        </button>
      </div>

      {adding && <PayEditor initial={emptyDraft} onCancel={() => setAdding(false)} onSave={addPayment} saveLabel="Crear pago" />}

      {rows.length === 0 && !adding ? (
        <div className="py-6 text-sm text-neutral-500">Sin pagos registrados para esta propiedad.</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-page text-left text-[11px] uppercase tracking-wide text-neutral-400">
                <th className="px-3 py-2 font-medium">Descripción</th>
                <th className="px-3 py-2 font-medium">Tipo</th>
                <th className="px-3 py-2 text-right font-medium">Monto</th>
                <th className="px-3 py-2 font-medium">Vence</th>
                <th className="px-3 py-2 font-medium">Estado</th>
                <th className="px-3 py-2 font-medium">QB</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) =>
                editingId === p.id ? (
                  <tr key={p.id}>
                    <td colSpan={7} className="p-3">
                      <PayEditor
                        initial={toDraft(p)}
                        onCancel={() => setEditingId(null)}
                        onSave={(dr) => saveEdit(p.id, dr)}
                        onDelete={() => remove(p.id)}
                        saveLabel="Guardar"
                      />
                    </td>
                  </tr>
                ) : (
                  <tr key={p.id} className="border-t border-line">
                    <td className="px-3 py-2">
                      <div className="font-medium">{p.description}</div>
                      {p.vendor_or_payer && (
                        <div className="text-xs text-neutral-400">{p.vendor_or_payer}</div>
                      )}
                    </td>
                    <td className="px-3 py-2"><PaymentTypeBadge type={p.payment_type} /></td>
                    <td className="px-3 py-2 text-right font-mono">{money(Number(p.amount), p.currency)}</td>
                    <td className="px-3 py-2 text-neutral-500">{p.due_date ?? "—"}</td>
                    <td className="px-3 py-2"><PaymentStatusBadge status={p.status} /></td>
                    <td className="px-3 py-2 font-mono text-xs text-neutral-500">{p.quickbooks_code ?? "—"}</td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-2 text-xs">
                        {p.status !== "Paid" && (
                          <button onClick={() => markPaid(p)} className="font-medium text-[#3b6d11] hover:underline">
                            Pagar
                          </button>
                        )}
                        <button onClick={() => setEditingId(p.id)} className="text-neutral-500 hover:underline">
                          Editar
                        </button>
                      </div>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
            <tfoot>
              <tr className="border-t border-line bg-page/60">
                <td colSpan={2} className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
                  Total pendiente
                </td>
                <td className="px-3 py-2 text-right font-mono font-semibold text-[#a32d2d]">
                  {money(pendingTotal)}
                </td>
                <td colSpan={4}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

function PayEditor({
  initial,
  onCancel,
  onSave,
  onDelete,
  saveLabel,
}: {
  initial: Draft;
  onCancel: () => void;
  onSave: (dr: Draft) => Promise<string | null>;
  onDelete?: () => void;
  saveLabel: string;
}) {
  const [dr, setDr] = useState<Draft>(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof Draft, v: string) => setDr((p) => ({ ...p, [k]: v }));

  async function submit() {
    if (!dr.description.trim()) { setErr("La descripción es obligatoria."); return; }
    setBusy(true);
    setErr(null);
    const e = await onSave(dr);
    setBusy(false);
    if (e) setErr(e);
  }

  return (
    <div className="space-y-2 rounded-lg border border-line bg-page/40 p-3 text-left">
      <input
        value={dr.description}
        onChange={(e) => set("description", e.target.value)}
        placeholder="Descripción — p. ej. Honorarios David, Cycle 2 resubmittal"
        className="w-full rounded-md border border-line px-3 py-1.5 text-sm font-medium outline-none focus:border-brand"
      />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <label className="text-xs text-neutral-500">
          Tipo
          <select value={dr.payment_type} onChange={(e) => set("payment_type", e.target.value)} className="mt-1 w-full rounded-md border border-line bg-card px-2 py-1.5 text-sm outline-none focus:border-brand">
            <option value="vendor">Proveedor</option>
            <option value="client">Cliente</option>
          </select>
        </label>
        <label className="text-xs text-neutral-500">
          Monto (USD)
          <input type="number" step="0.01" value={dr.amount} onChange={(e) => set("amount", e.target.value)} placeholder="0.00" className="mt-1 w-full rounded-md border border-line px-2 py-1.5 text-sm outline-none focus:border-brand" />
        </label>
        <label className="text-xs text-neutral-500">
          Estado
          <select value={dr.status} onChange={(e) => set("status", e.target.value)} className="mt-1 w-full rounded-md border border-line bg-card px-2 py-1.5 text-sm outline-none focus:border-brand">
            {PAYMENT_STATUSES.map((s) => (<option key={s} value={s}>{s}</option>))}
          </select>
        </label>
        <label className="text-xs text-neutral-500">
          Vencimiento
          <input type="date" value={dr.due_date} onChange={(e) => set("due_date", e.target.value)} className="mt-1 w-full rounded-md border border-line px-2 py-1.5 text-sm outline-none focus:border-brand" />
        </label>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="text-xs text-neutral-500">
          Proveedor / pagador
          <input value={dr.vendor_or_payer} onChange={(e) => set("vendor_or_payer", e.target.value)} placeholder="David, Dueño…" className="mt-1 w-full rounded-md border border-line px-2 py-1.5 text-sm outline-none focus:border-brand" />
        </label>
        <label className="text-xs text-neutral-500">
          Código QuickBooks
          <input value={dr.quickbooks_code} onChange={(e) => set("quickbooks_code", e.target.value)} placeholder="QB-…" className="mt-1 w-full rounded-md border border-line px-2 py-1.5 text-sm font-mono outline-none focus:border-brand" />
        </label>
      </div>
      <textarea value={dr.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Notas…" rows={2} className="w-full resize-y rounded-md border border-line px-3 py-1.5 text-sm outline-none focus:border-brand" />
      {err && <div className="text-xs text-[#a32d2d]">{err}</div>}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button onClick={submit} disabled={busy} className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-60">
            {busy ? "Guardando…" : saveLabel}
          </button>
          <button onClick={onCancel} className="rounded-md border border-line px-3 py-1.5 text-sm text-neutral-600 hover:bg-page">Cancelar</button>
        </div>
        {onDelete && (
          <button onClick={onDelete} className="rounded-md px-3 py-1.5 text-sm font-medium text-[#a32d2d] hover:bg-[#fcebeb]">Eliminar</button>
        )}
      </div>
    </div>
  );
}
