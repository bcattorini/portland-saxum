"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { PaymentStatus, PaymentType } from "@/lib/types";
import { PAYMENT_STATUSES } from "@/lib/types";
import { PaymentStatusBadge, PaymentTypeBadge } from "@/lib/badges";
import { QbCodeInput } from "./QbCodeInput";

const money = (n: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);
const STATUS_ES: Record<PaymentStatus, string> = {
  Pending: "Pendiente", Paid: "Pagado", Overdue: "Vencido", Cancelled: "Cancelado",
};
const TYPE_ES = (t: PaymentType) => (t === "vendor" ? "Proveedor" : "Cliente");

type Row = {
  id: string;
  description: string;
  payment_type: PaymentType;
  vendor_or_payer: string | null;
  amount: number;
  currency: string;
  due_date: string | null;
  paid_date: string | null;
  status: PaymentStatus;
  quickbooks_code: string | null;
  quickbooks_code_id: string | null;
  notes: string | null;
  sort_order: number | null;
  created_at: string;
  property_id?: string;
};

type Draft = {
  description: string;
  payment_type: PaymentType;
  vendor_or_payer: string;
  amount: string;
  due_date: string;
  status: PaymentStatus;
  quickbooks_code: string;
  quickbooks_code_id: string | null;
  notes: string;
};

const emptyDraft: Draft = {
  description: "", payment_type: "vendor", vendor_or_payer: "", amount: "",
  due_date: "", status: "Pending", quickbooks_code: "", quickbooks_code_id: null, notes: "",
};
const toDraft = (p: Row): Draft => ({
  description: p.description,
  payment_type: p.payment_type,
  vendor_or_payer: p.vendor_or_payer ?? "",
  amount: String(p.amount ?? ""),
  due_date: p.due_date ?? "",
  status: p.status,
  quickbooks_code: p.quickbooks_code ?? "",
  quickbooks_code_id: p.quickbooks_code_id ?? null,
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
  quickbooks_code_id: dr.quickbooks_code_id || null,
  notes: dr.notes.trim() || null,
});

export function PaymentsManager({
  scope,
  propertyId,
  propertyAddress,
}: {
  scope: "property" | "general";
  propertyId?: string;
  propertyAddress?: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const table = scope === "property" ? "payments" : "general_payments";
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [exportMode, setExportMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      let q = supabase.from(table).select("*");
      if (scope === "property") q = q.eq("property_id", propertyId!);
      const { data, error } = await q.order("sort_order", { nullsFirst: false }).order("created_at");
      if (cancelled) return;
      if (error) setError(error.message);
      else setRows((data ?? []) as Row[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [table, scope, propertyId, supabase]);

  async function addPayment(dr: Draft) {
    const nextSort = (rows.reduce((m, r) => Math.max(m, r.sort_order ?? 0), 0) || 0) + 1;
    const base: Record<string, unknown> = { sort_order: nextSort, ...draftToRow(dr) };
    if (scope === "property") base.property_id = propertyId;
    const { data, error } = await supabase.from(table).insert(base).select().single();
    if (error) return error.message;
    setRows((prev) => [...prev, data as Row]);
    setAdding(false);
    return null;
  }
  async function saveEdit(id: string, dr: Draft) {
    const { data, error } = await supabase.from(table).update(draftToRow(dr)).eq("id", id).select().single();
    if (error) return error.message;
    setRows((prev) => prev.map((r) => (r.id === id ? (data as Row) : r)));
    setEditingId(null);
    return null;
  }
  async function markPaid(p: Row) {
    const today = new Date().toISOString().slice(0, 10);
    const { data } = await supabase.from(table).update({ status: "Paid", paid_date: today }).eq("id", p.id).select().single();
    if (data) setRows((prev) => prev.map((r) => (r.id === p.id ? (data as Row) : r)));
  }
  async function remove(id: string) {
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (!error) setRows((prev) => prev.filter((r) => r.id !== id));
  }

  function startExport() { setSelectedIds(new Set(rows.map((r) => r.id))); setAdding(false); setEditingId(null); setExportMode(true); }
  function toggleSel(id: string) {
    setSelectedIds((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }
  async function downloadPdf() {
    const chosen = rows.filter((r) => selectedIds.has(r.id));
    if (!chosen.length) return;
    const { jsPDF } = await import("jspdf");
    const autoTable = (await import("jspdf-autotable")).default;
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const subtitle = scope === "property" ? propertyAddress ?? "" : "Pagos a nivel empresa";
    doc.setFontSize(16); doc.setTextColor(27, 58, 107); doc.text("Portland Saxum - Pagos", 40, 46);
    doc.setFontSize(10); doc.setTextColor(90, 90, 90);
    doc.text(subtitle, 40, 64);
    doc.text(`Generado: ${new Date().toLocaleDateString("es")}`, 40, 78);
    const body = chosen.map((p) => [p.description, TYPE_ES(p.payment_type), money(Number(p.amount), p.currency), p.due_date ?? "-", STATUS_ES[p.status], p.quickbooks_code ?? "-"]);
    const pending = chosen.filter((r) => r.status === "Pending" || r.status === "Overdue").reduce((s, r) => s + Number(r.amount || 0), 0);
    const paid = chosen.filter((r) => r.status === "Paid").reduce((s, r) => s + Number(r.amount || 0), 0);
    const right = "right" as const;
    autoTable(doc, {
      startY: 94,
      head: [["Descripción", "Tipo", "Monto", "Vence", "Estado", "QB"]],
      body,
      foot: [
        [{ content: "Total pendiente", colSpan: 2, styles: { halign: right } }, { content: money(pending), styles: { halign: right } }, { content: "", colSpan: 3 }],
        [{ content: "Total pagado", colSpan: 2, styles: { halign: right } }, { content: money(paid), styles: { halign: right } }, { content: "", colSpan: 3 }],
      ],
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: [27, 58, 107] },
      footStyles: { fillColor: [244, 243, 238], textColor: [31, 30, 27], fontStyle: "bold" },
      columnStyles: { 2: { halign: right } },
    });
    doc.save(`Pagos_${(subtitle || "empresa").replace(/[^\w]+/g, "_")}.pdf`);
    setExportMode(false);
  }

  const pendingTotal = rows.filter((r) => r.status === "Pending" || r.status === "Overdue").reduce((s, r) => s + Number(r.amount || 0), 0);

  if (loading) return <div className="py-8 text-center text-sm text-neutral-400">Cargando…</div>;
  if (error) return <div className="py-4 text-sm text-[#a32d2d]">Error: {error}</div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-neutral-500">{rows.length} pagos</span>
        <div className="flex gap-2">
          {rows.length > 0 && !exportMode && (
            <button onClick={startExport} className="rounded-md border border-line px-3 py-1.5 text-sm font-medium text-neutral-600 hover:bg-page">Exportar PDF</button>
          )}
          <button onClick={() => setAdding((v) => !v)} className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-hover">
            {adding ? "Cancelar" : "+ Agregar pago"}
          </button>
        </div>
      </div>

      {exportMode && (
        <div className="space-y-2 rounded-lg border border-brand/40 bg-page/40 p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Seleccioná los pagos a exportar</span>
            <div className="flex gap-3 text-xs">
              <button onClick={() => setSelectedIds(new Set(rows.map((r) => r.id)))} className="text-brand hover:underline">Todos</button>
              <button onClick={() => setSelectedIds(new Set())} className="text-neutral-500 hover:underline">Ninguno</button>
            </div>
          </div>
          <ul className="max-h-64 divide-y divide-line overflow-y-auto rounded-md border border-line bg-card">
            {rows.map((p) => (
              <li key={p.id}>
                <label className="flex cursor-pointer items-center gap-2.5 px-3 py-2 hover:bg-page/50">
                  <input type="checkbox" checked={selectedIds.has(p.id)} onChange={() => toggleSel(p.id)} className="h-4 w-4 accent-[#1b3a6b]" />
                  <span className="flex-1 truncate text-sm">{p.description}</span>
                  <span className="font-mono text-xs text-neutral-500">{money(Number(p.amount), p.currency)}</span>
                  <PaymentStatusBadge status={p.status} />
                </label>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <button onClick={downloadPdf} disabled={selectedIds.size === 0} className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50">
              Descargar PDF ({selectedIds.size})
            </button>
            <button onClick={() => setExportMode(false)} className="rounded-md border border-line px-3 py-1.5 text-sm text-neutral-600 hover:bg-page">Cancelar</button>
          </div>
        </div>
      )}

      {adding && <PaymentEditor initial={emptyDraft} onCancel={() => setAdding(false)} onSave={addPayment} saveLabel="Crear pago" />}

      {rows.length === 0 && !adding ? (
        <div className="py-6 text-sm text-neutral-500">Sin pagos registrados todavía.</div>
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
                      <PaymentEditor initial={toDraft(p)} onCancel={() => setEditingId(null)} onSave={(dr) => saveEdit(p.id, dr)} onDelete={() => remove(p.id)} saveLabel="Guardar" />
                    </td>
                  </tr>
                ) : (
                  <tr key={p.id} className="border-t border-line">
                    <td className="px-3 py-2">
                      <div className="font-medium">{p.description}</div>
                      {p.vendor_or_payer && <div className="text-xs text-neutral-400">{p.vendor_or_payer}</div>}
                    </td>
                    <td className="px-3 py-2"><PaymentTypeBadge type={p.payment_type} /></td>
                    <td className="px-3 py-2 text-right font-mono">{money(Number(p.amount), p.currency)}</td>
                    <td className="px-3 py-2 text-neutral-500">{p.due_date ?? "—"}</td>
                    <td className="px-3 py-2"><PaymentStatusBadge status={p.status} /></td>
                    <td className="px-3 py-2 font-mono text-xs text-neutral-500">{p.quickbooks_code ?? "—"}</td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-2 text-xs">
                        {p.status !== "Paid" && <button onClick={() => markPaid(p)} className="font-medium text-[#3b6d11] hover:underline">Pagar</button>}
                        <button onClick={() => setEditingId(p.id)} className="text-neutral-500 hover:underline">Editar</button>
                      </div>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
            <tfoot>
              <tr className="border-t border-line bg-page/60">
                <td colSpan={2} className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-neutral-500">Total pendiente</td>
                <td className="px-3 py-2 text-right font-mono font-semibold text-[#a32d2d]">{money(pendingTotal)}</td>
                <td colSpan={4}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

function PaymentEditor({
  initial, onCancel, onSave, onDelete, saveLabel,
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
    setBusy(true); setErr(null);
    const e = await onSave(dr);
    setBusy(false);
    if (e) setErr(e);
  }

  return (
    <div className="space-y-2 rounded-lg border border-line bg-page/40 p-3 text-left">
      <input value={dr.description} onChange={(e) => set("description", e.target.value)} placeholder="Descripción — p. ej. Honorarios David, Cycle 2 resubmittal"
        className="w-full rounded-md border border-line px-3 py-1.5 text-sm font-medium outline-none focus:border-brand" />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <label className="text-xs text-neutral-500">Tipo
          <select value={dr.payment_type} onChange={(e) => set("payment_type", e.target.value)} className="mt-1 w-full rounded-md border border-line bg-card px-2 py-1.5 text-sm outline-none focus:border-brand">
            <option value="vendor">Proveedor</option>
            <option value="client">Cliente</option>
          </select>
        </label>
        <label className="text-xs text-neutral-500">Monto (USD)
          <input type="number" step="0.01" value={dr.amount} onChange={(e) => set("amount", e.target.value)} placeholder="0.00" className="mt-1 w-full rounded-md border border-line px-2 py-1.5 text-sm outline-none focus:border-brand" />
        </label>
        <label className="text-xs text-neutral-500">Estado
          <select value={dr.status} onChange={(e) => set("status", e.target.value)} className="mt-1 w-full rounded-md border border-line bg-card px-2 py-1.5 text-sm outline-none focus:border-brand">
            {PAYMENT_STATUSES.map((s) => (<option key={s} value={s}>{s}</option>))}
          </select>
        </label>
        <label className="text-xs text-neutral-500">Vencimiento
          <input type="date" value={dr.due_date} onChange={(e) => set("due_date", e.target.value)} className="mt-1 w-full rounded-md border border-line px-2 py-1.5 text-sm outline-none focus:border-brand" />
        </label>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="text-xs text-neutral-500">Proveedor / pagador
          <input value={dr.vendor_or_payer} onChange={(e) => set("vendor_or_payer", e.target.value)} placeholder="David, Dueño…" className="mt-1 w-full rounded-md border border-line px-2 py-1.5 text-sm outline-none focus:border-brand" />
        </label>
        <label className="text-xs text-neutral-500">Código QuickBooks
          <QbCodeInput code={dr.quickbooks_code} codeId={dr.quickbooks_code_id} description={dr.description}
            onChange={(code, id) => setDr((p) => ({ ...p, quickbooks_code: code, quickbooks_code_id: id }))} />
        </label>
      </div>
      <textarea value={dr.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Notas…" rows={2} className="w-full resize-y rounded-md border border-line px-3 py-1.5 text-sm outline-none focus:border-brand" />
      {err && <div className="text-xs text-[#a32d2d]">{err}</div>}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button onClick={submit} disabled={busy} className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-60">{busy ? "Guardando…" : saveLabel}</button>
          <button onClick={onCancel} className="rounded-md border border-line px-3 py-1.5 text-sm text-neutral-600 hover:bg-page">Cancelar</button>
        </div>
        {onDelete && <button onClick={onDelete} className="rounded-md px-3 py-1.5 text-sm font-medium text-[#a32d2d] hover:bg-[#fcebeb]">Eliminar</button>}
      </div>
    </div>
  );
}
