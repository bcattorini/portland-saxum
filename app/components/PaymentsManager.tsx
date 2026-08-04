"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { PaymentStatus, PaymentType } from "@/lib/types";
import { PAYMENT_STATUSES } from "@/lib/types";
import { PaymentStatusBadge, PaymentTypeBadge } from "@/lib/badges";
import { personForEmail } from "@/lib/users";
import { QbCodeInput } from "./QbCodeInput";

const money = (n: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);
const STATUS_ES: Record<PaymentStatus, string> = {
  Pending: "Pendiente", Paid: "Pagado", Overdue: "Vencido", Cancelled: "Cancelado",
};
const TYPE_ES = (t: PaymentType) => (t === "vendor" ? "Proveedor" : "Cliente");
// default grouping: overdue + pending first, paid/cancelled last
const STATUS_ORDER: Record<PaymentStatus, number> = { Overdue: 0, Pending: 1, Paid: 2, Cancelled: 3 };
const fmtDate = (d: string) => {
  const [y, m, dd] = d.split("-");
  return `${dd}/${m}/${y}`;
};

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
  project: string | null;
  invoice_url: string | null;
  notes: string | null;
  approved_at: string | null;
  approved_by: string | null;
  sort_order: number | null;
  created_at: string;
  property_id?: string;
};

// Approval workflow stage, derived from status + approved_at.
type Stage = "cargado" | "por_pagar" | "pagado" | "cancelado";
function stageOf(r: Row): Stage {
  if (r.status === "Cancelled") return "cancelado";
  if (r.status === "Paid") return "pagado";
  if (r.approved_at) return "por_pagar";
  return "cargado";
}
const STAGES: { key: Stage; label: string; hint: string }[] = [
  { key: "cargado", label: "Cargados", hint: "esperando aprobación de Bruno" },
  { key: "por_pagar", label: "Por pagar", hint: "aprobados, listos para pagar" },
  { key: "pagado", label: "Pagados", hint: "" },
  { key: "cancelado", label: "Cancelados", hint: "" },
];

type Draft = {
  description: string;
  payment_type: PaymentType;
  vendor_or_payer: string;
  amount: string;
  due_date: string;
  status: PaymentStatus;
  quickbooks_code: string;
  quickbooks_code_id: string | null;
  project: string;
  invoice_url: string | null;
  notes: string;
};

const emptyDraft: Draft = {
  description: "", payment_type: "vendor", vendor_or_payer: "", amount: "", due_date: "",
  status: "Pending", quickbooks_code: "", quickbooks_code_id: null, project: "", invoice_url: null, notes: "",
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
  project: p.project ?? "",
  invoice_url: p.invoice_url ?? null,
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
  project: dr.project.trim() || null,
  invoice_url: dr.invoice_url || null,
  notes: dr.notes.trim() || null,
});

const emptyFilters = { project: "", status: "all", type: "all", dueFrom: "", dueTo: "", paidFrom: "", paidTo: "" };

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
  const [filters, setFilters] = useState(emptyFilters);
  const [sort, setSort] = useState<{ field: string; dir: "asc" | "desc" }>({ field: "status", dir: "asc" });
  const [meEmail, setMeEmail] = useState<string | null>(null);
  const isBruno = personForEmail(meEmail)?.name === "Bruno";

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMeEmail(data.user?.email ?? null));
  }, [supabase]);

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
  async function approve(p: Row) {
    if (!isBruno) return;
    const { data } = await supabase.from(table)
      .update({ approved_at: new Date().toISOString(), approved_by: meEmail }).eq("id", p.id).select().single();
    if (data) setRows((prev) => prev.map((r) => (r.id === p.id ? (data as Row) : r)));
  }
  async function unapprove(p: Row) {
    if (!isBruno) return;
    const { data } = await supabase.from(table)
      .update({ approved_at: null, approved_by: null }).eq("id", p.id).select().single();
    if (data) setRows((prev) => prev.map((r) => (r.id === p.id ? (data as Row) : r)));
  }
  async function remove(id: string) {
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (!error) setRows((prev) => prev.filter((r) => r.id !== id));
  }
  async function openInvoice(path: string) {
    const { data } = await supabase.storage.from("invoices").createSignedUrl(path, 120);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener");
  }

  // -- filters (client-side) --
  const filtered = rows.filter((r) => {
    const f = filters;
    if (f.project && !(r.project ?? "").toLowerCase().includes(f.project.toLowerCase())) return false;
    if (f.status !== "all" && r.status !== f.status) return false;
    if (f.type !== "all" && r.payment_type !== f.type) return false;
    if (f.dueFrom && (!r.due_date || r.due_date < f.dueFrom)) return false;
    if (f.dueTo && (!r.due_date || r.due_date > f.dueTo)) return false;
    if (f.paidFrom && (!r.paid_date || r.paid_date < f.paidFrom)) return false;
    if (f.paidTo && (!r.paid_date || r.paid_date > f.paidTo)) return false;
    return true;
  });
  const filtersActive = JSON.stringify(filters) !== JSON.stringify(emptyFilters);
  const setF = (k: keyof typeof emptyFilters, v: string) => setFilters((p) => ({ ...p, [k]: v }));

  function startExport() { setSelectedIds(new Set(filtered.map((r) => r.id))); setAdding(false); setEditingId(null); setExportMode(true); }
  function toggleSel(id: string) { setSelectedIds((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; }); }
  async function downloadPdf() {
    const chosen = filtered.filter((r) => selectedIds.has(r.id));
    if (!chosen.length) return;
    const { jsPDF } = await import("jspdf");
    const autoTable = (await import("jspdf-autotable")).default;
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const subtitle = scope === "property" ? propertyAddress ?? "" : "Pagos a nivel empresa";
    doc.setFontSize(16); doc.setTextColor(27, 58, 107); doc.text("Portland Saxum - Pagos", 40, 46);
    doc.setFontSize(10); doc.setTextColor(90, 90, 90);
    doc.text(subtitle, 40, 64);
    doc.text(`Generado: ${new Date().toLocaleDateString("es")}`, 40, 78);
    const body = chosen.map((p) => [p.project ?? "-", p.description, TYPE_ES(p.payment_type), money(Number(p.amount), p.currency), p.due_date ?? "-", STATUS_ES[p.status], p.quickbooks_code ?? "-"]);
    const pending = chosen.filter((r) => r.status === "Pending" || r.status === "Overdue").reduce((s, r) => s + Number(r.amount || 0), 0);
    const paid = chosen.filter((r) => r.status === "Paid").reduce((s, r) => s + Number(r.amount || 0), 0);
    const right = "right" as const;
    autoTable(doc, {
      startY: 94,
      head: [["Proyecto", "Descripción", "Tipo", "Monto", "Vence", "Estado", "QB"]],
      body,
      foot: [
        [{ content: "Total pendiente", colSpan: 3, styles: { halign: right } }, { content: money(pending), styles: { halign: right } }, { content: "", colSpan: 3 }],
        [{ content: "Total pagado", colSpan: 3, styles: { halign: right } }, { content: money(paid), styles: { halign: right } }, { content: "", colSpan: 3 }],
      ],
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [27, 58, 107] },
      footStyles: { fillColor: [244, 243, 238], textColor: [31, 30, 27], fontStyle: "bold" },
      columnStyles: { 3: { halign: right } },
    });
    doc.save(`Pagos_${(subtitle || "empresa").replace(/[^\w]+/g, "_")}.pdf`);
    setExportMode(false);
  }
  async function downloadExcel() {
    const chosen = filtered.filter((r) => selectedIds.has(r.id));
    if (!chosen.length) return;
    const XLSX = await import("xlsx");
    const stageLabel: Record<Stage, string> = { cargado: "Cargado", por_pagar: "Por pagar", pagado: "Pagado", cancelado: "Cancelado" };
    const aoa = chosen.map((p) => ({
      Proyecto: p.project ?? "",
      Descripción: p.description,
      Tipo: TYPE_ES(p.payment_type),
      "Proveedor/Pagador": p.vendor_or_payer ?? "",
      Monto: Number(p.amount || 0),
      Moneda: p.currency,
      Vence: p.due_date ?? "",
      Etapa: stageLabel[stageOf(p)],
      Estado: STATUS_ES[p.status],
      "Aprobado por": p.approved_by ?? "",
      "Fecha pago": p.paid_date ?? "",
      QB: p.quickbooks_code ?? "",
      Notas: p.notes ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pagos");
    const subtitle = scope === "property" ? propertyAddress ?? "propiedad" : "empresa";
    XLSX.writeFile(wb, `Pagos_${subtitle.replace(/[^\w]+/g, "_")}.xlsx`);
    setExportMode(false);
  }

  // -- sort (click a column header) --
  function toggleSort(field: string) {
    setSort((s) => (s.field === field ? { field, dir: s.dir === "asc" ? "desc" : "asc" } : { field, dir: "asc" }));
  }
  const sorted = [...filtered].sort((a, b) => {
    const dir = sort.dir === "asc" ? 1 : -1;
    const dueA = a.due_date ?? "9999-99-99", dueB = b.due_date ?? "9999-99-99";
    let r = 0;
    switch (sort.field) {
      case "status": r = STATUS_ORDER[a.status] - STATUS_ORDER[b.status]; if (r === 0) r = dueA < dueB ? -1 : dueA > dueB ? 1 : 0; break;
      case "amount": r = Number(a.amount || 0) - Number(b.amount || 0); break;
      case "due_date": r = dueA < dueB ? -1 : dueA > dueB ? 1 : 0; break;
      case "project": r = (a.project ?? "").localeCompare(b.project ?? ""); break;
      case "description": r = a.description.localeCompare(b.description); break;
      case "type": r = a.payment_type.localeCompare(b.payment_type); break;
    }
    return r * dir;
  });
  const th = (field: string, label: string, right = false) => {
    const active = sort.field === field;
    return (
      <th className={"px-3 py-2 " + (right ? "text-right" : "")}>
        <button onClick={() => toggleSort(field)} className={"inline-flex items-center gap-1 font-medium uppercase tracking-wide hover:text-neutral-700 " + (active ? "text-neutral-700" : "")}>
          {label}
          {active && <span className="text-[8px]">{sort.dir === "asc" ? "▲" : "▼"}</span>}
        </button>
      </th>
    );
  };

  const rowEl = (p: Row, stage: Stage) =>
    editingId === p.id ? (
      <tr key={p.id}>
        <td colSpan={8} className="p-3">
          <PaymentEditor initial={toDraft(p)} onCancel={() => setEditingId(null)} onSave={(dr) => saveEdit(p.id, dr)} onDelete={() => remove(p.id)} saveLabel="Guardar" scope={scope} propertyId={propertyId} existingId={p.id} />
        </td>
      </tr>
    ) : (
      <tr key={p.id} className="border-t border-line">
        <td className="px-3 py-2 text-neutral-600">{p.project ?? "—"}</td>
        <td className="px-3 py-2">
          <div className="flex items-center gap-1.5">
            <span className="font-medium">{p.description}</span>
            {p.invoice_url && (
              <button onClick={() => openInvoice(p.invoice_url!)} title="Ver invoice (PDF)" className="text-[#a32d2d] hover:text-[#7a2020]">
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V7.414A2 2 0 0017.414 6L14 2.586A2 2 0 0012.586 2H4zm8 1.5L15.5 8H13a1 1 0 01-1-1V4.5zM6 10h8v1H6v-1zm0 3h8v1H6v-1z" /></svg>
              </button>
            )}
          </div>
          {p.vendor_or_payer && <div className="text-xs text-neutral-400">{p.vendor_or_payer}</div>}
        </td>
        <td className="px-3 py-2"><PaymentTypeBadge type={p.payment_type} /></td>
        <td className="px-3 py-2 text-right font-mono">{money(Number(p.amount), p.currency)}</td>
        <td className="px-3 py-2 text-neutral-500">{p.due_date ?? "—"}</td>
        <td className="px-3 py-2">
          <PaymentStatusBadge status={p.status} />
          {p.status === "Paid" && p.paid_date && (
            <div className="mt-0.5 text-[11px] text-neutral-400">Pagado el {fmtDate(p.paid_date)}</div>
          )}
          {(stage === "por_pagar" || stage === "pagado") && p.approved_by && (
            <div className="mt-0.5 text-[11px] text-neutral-400">Aprobó {personForEmail(p.approved_by)?.name ?? p.approved_by}</div>
          )}
        </td>
        <td className="px-3 py-2 font-mono text-xs text-neutral-500">{p.quickbooks_code ?? "—"}</td>
        <td className="px-3 py-2">
          <div className="flex justify-end gap-2 text-xs">
            {stage === "cargado" && (isBruno
              ? <button onClick={() => approve(p)} className="font-medium text-[#1b3a6b] hover:underline">Aprobar</button>
              : <span className="text-neutral-400">Esperando a Bruno</span>)}
            {stage === "por_pagar" && <button onClick={() => markPaid(p)} className="font-medium text-[#3b6d11] hover:underline">Pagar</button>}
            {stage === "por_pagar" && isBruno && <button onClick={() => unapprove(p)} className="text-neutral-400 hover:underline">Quitar aprob.</button>}
            <button onClick={() => setEditingId(p.id)} className="text-neutral-500 hover:underline">Editar</button>
          </div>
        </td>
      </tr>
    );

  const stageAmountClass: Record<Stage, string> = {
    cargado: "text-neutral-600", por_pagar: "text-[#a32d2d]", pagado: "text-[#3b6d11]", cancelado: "text-neutral-400",
  };

  if (loading) return <div className="py-8 text-center text-sm text-neutral-400">Cargando…</div>;
  if (error) return <div className="py-4 text-sm text-[#a32d2d]">Error: {error}</div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-neutral-500">
          {filtered.length} pagos{filtered.length !== rows.length ? ` de ${rows.length}` : ""}
        </span>
        <div className="flex gap-2">
          {filtered.length > 0 && !exportMode && (
            <button onClick={startExport} className="rounded-md border border-line px-3 py-1.5 text-sm font-medium text-neutral-600 hover:bg-page">Exportar</button>
          )}
          <button onClick={() => setAdding((v) => !v)} className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-hover">
            {adding ? "Cancelar" : "+ Agregar pago"}
          </button>
        </div>
      </div>

      {/* Filtros tipo Excel */}
      {rows.length > 0 && (
        <div className="flex flex-wrap items-end gap-x-3 gap-y-2 rounded-lg border border-line bg-page/40 px-3 py-2.5 text-xs">
          <label className="flex flex-col gap-1">
            <span className="text-neutral-500">Proyecto</span>
            <input value={filters.project} onChange={(e) => setF("project", e.target.value)} placeholder="ej: 134"
              className="w-28 rounded-md border border-line px-2 py-1 outline-none focus:border-brand" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-neutral-500">Status</span>
            <select value={filters.status} onChange={(e) => setF("status", e.target.value)} className="rounded-md border border-line bg-card px-2 py-1 outline-none focus:border-brand">
              <option value="all">Todos</option>
              {PAYMENT_STATUSES.map((s) => (<option key={s} value={s}>{STATUS_ES[s]}</option>))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-neutral-500">Tipo</span>
            <select value={filters.type} onChange={(e) => setF("type", e.target.value)} className="rounded-md border border-line bg-card px-2 py-1 outline-none focus:border-brand">
              <option value="all">Todos</option>
              <option value="vendor">Proveedor</option>
              <option value="client">Cliente</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-neutral-500">Vence desde</span>
            <input type="date" value={filters.dueFrom} onChange={(e) => setF("dueFrom", e.target.value)} className="rounded-md border border-line px-2 py-1 outline-none focus:border-brand" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-neutral-500">Vence hasta</span>
            <input type="date" value={filters.dueTo} onChange={(e) => setF("dueTo", e.target.value)} className="rounded-md border border-line px-2 py-1 outline-none focus:border-brand" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-neutral-500">Pago desde</span>
            <input type="date" value={filters.paidFrom} onChange={(e) => setF("paidFrom", e.target.value)} className="rounded-md border border-line px-2 py-1 outline-none focus:border-brand" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-neutral-500">Pago hasta</span>
            <input type="date" value={filters.paidTo} onChange={(e) => setF("paidTo", e.target.value)} className="rounded-md border border-line px-2 py-1 outline-none focus:border-brand" />
          </label>
          {filtersActive && (
            <button onClick={() => setFilters(emptyFilters)} className="rounded-md border border-line px-2.5 py-1 font-medium text-neutral-600 hover:bg-card">
              Limpiar filtros
            </button>
          )}
        </div>
      )}

      {exportMode && (
        <div className="space-y-2 rounded-lg border border-brand/40 bg-page/40 p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Seleccioná los pagos a exportar</span>
            <div className="flex gap-3 text-xs">
              <button onClick={() => setSelectedIds(new Set(filtered.map((r) => r.id)))} className="text-brand hover:underline">Todos</button>
              <button onClick={() => setSelectedIds(new Set())} className="text-neutral-500 hover:underline">Ninguno</button>
            </div>
          </div>
          <ul className="max-h-64 divide-y divide-line overflow-y-auto rounded-md border border-line bg-card">
            {filtered.map((p) => (
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
            <button onClick={downloadExcel} disabled={selectedIds.size === 0} className="rounded-md bg-[#1d6f42] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#175733] disabled:opacity-50">
              Descargar Excel ({selectedIds.size})
            </button>
            <button onClick={downloadPdf} disabled={selectedIds.size === 0} className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50">
              Descargar PDF ({selectedIds.size})
            </button>
            <button onClick={() => setExportMode(false)} className="rounded-md border border-line px-3 py-1.5 text-sm text-neutral-600 hover:bg-page">Cancelar</button>
          </div>
        </div>
      )}

      {adding && (
        <PaymentEditor initial={emptyDraft} onCancel={() => setAdding(false)} onSave={addPayment} saveLabel="Crear pago" scope={scope} propertyId={propertyId} existingId={null} />
      )}

      {rows.length === 0 && !adding ? (
        <div className="py-6 text-sm text-neutral-500">Sin pagos registrados todavía.</div>
      ) : filtered.length === 0 ? (
        <div className="py-6 text-sm text-neutral-500">Ningún pago coincide con los filtros.</div>
      ) : (
        <div className="space-y-5">
          {STAGES.map((st) => {
            const group = sorted.filter((p) => stageOf(p) === st.key);
            if (group.length === 0) return null;
            const subtotal = group.reduce((s, r) => s + Number(r.amount || 0), 0);
            return (
              <div key={st.key}>
                <div className="mb-1.5 flex items-baseline justify-between gap-2">
                  <span className="text-sm font-semibold">
                    {st.label} <span className="font-normal text-neutral-400">({group.length}){st.hint ? ` · ${st.hint}` : ""}</span>
                  </span>
                  <span className={"font-mono text-sm font-semibold " + stageAmountClass[st.key]}>{money(subtotal)}</span>
                </div>
                <div className="overflow-x-auto rounded-lg border border-line">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-page text-left text-[11px] uppercase tracking-wide text-neutral-400">
                        {th("project", "Proyecto")}
                        {th("description", "Descripción")}
                        {th("type", "Tipo")}
                        {th("amount", "Monto", true)}
                        {th("due_date", "Vence")}
                        {th("status", "Estado")}
                        <th className="px-3 py-2 font-medium">QB</th>
                        <th className="px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.map((p) => rowEl(p, st.key))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PaymentEditor({
  initial, onCancel, onSave, onDelete, saveLabel, scope, propertyId, existingId,
}: {
  initial: Draft;
  onCancel: () => void;
  onSave: (dr: Draft) => Promise<string | null>;
  onDelete?: () => void;
  saveLabel: string;
  scope: "property" | "general";
  propertyId?: string;
  existingId: string | null;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [dr, setDr] = useState<Draft>(initial);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const folderId = useMemo(() => existingId ?? crypto.randomUUID(), [existingId]);
  const set = (k: keyof Draft, v: string) => setDr((p) => ({ ...p, [k]: v }));

  async function handleFile(file: File) {
    if (file.type !== "application/pdf") { setErr("El invoice debe ser un PDF."); return; }
    setUploading(true); setErr(null);
    const base = scope === "property" ? propertyId ?? "general" : "general";
    const path = `${base}/${folderId}/invoice.pdf`;
    const { error } = await supabase.storage.from("invoices").upload(path, file, { upsert: true, contentType: "application/pdf" });
    setUploading(false);
    if (error) { setErr("Error al subir: " + error.message); return; }
    setDr((p) => ({ ...p, invoice_url: path }));
  }

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
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <label className="text-xs text-neutral-500">Proyecto
          <input value={dr.project} onChange={(e) => set("project", e.target.value)} placeholder="ej: LR 134, BV 5040, General…" className="mt-1 w-full rounded-md border border-line px-2 py-1.5 text-sm outline-none focus:border-brand" />
        </label>
        <label className="text-xs text-neutral-500">Proveedor / pagador
          <input value={dr.vendor_or_payer} onChange={(e) => set("vendor_or_payer", e.target.value)} placeholder="David, Dueño…" className="mt-1 w-full rounded-md border border-line px-2 py-1.5 text-sm outline-none focus:border-brand" />
        </label>
        <label className="text-xs text-neutral-500">Código QuickBooks
          <QbCodeInput code={dr.quickbooks_code} codeId={dr.quickbooks_code_id} description={dr.description}
            onChange={(code, id) => setDr((p) => ({ ...p, quickbooks_code: code, quickbooks_code_id: id }))} />
        </label>
      </div>

      {/* Invoice PDF */}
      <div className="flex items-center gap-2">
        <input ref={fileRef} type="file" accept="application/pdf" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
        {dr.invoice_url ? (
          <>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-[#3b6d11]">
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V7.414A2 2 0 0017.414 6L14 2.586A2 2 0 0012.586 2H4z" /></svg>
              Invoice adjunto
            </span>
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="text-xs text-neutral-500 hover:underline disabled:opacity-50">
              {uploading ? "Subiendo…" : "Reemplazar"}
            </button>
          </>
        ) : (
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="rounded-md border border-line px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-card disabled:opacity-50">
            {uploading ? "Subiendo…" : "📎 Adjuntar invoice (PDF)"}
          </button>
        )}
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
