"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { createClient } from "@/lib/supabase/client";
import type {
  Comment,
  CommentTracking,
  Discipline,
  InternalStatus,
  PropertyWithStats,
} from "@/lib/types";
import { INTERNAL_STATUSES } from "@/lib/types";
import {
  CommentStatusBadge,
  DisciplineStatusBadge,
  InternalStatusBadge,
} from "@/lib/badges";
import { CommentDrawer } from "./CommentDrawer";
import { DocumentosTab } from "./DocumentosTab";
import { PaymentsManager } from "@/app/components/PaymentsManager";

type Tab = "planos" | "docs" | "pagos";

const TABS: { key: Tab; label: string }[] = [
  { key: "planos", label: "Planos & Ciudad" },
  { key: "docs", label: "Documentos" },
  { key: "pagos", label: "Pagos" },
];

export function PropertyPanel({ property, readOnly = false }: { property: PropertyWithStats; readOnly?: boolean }) {
  const [tab, setTab] = useState<Tab>("planos");
  const tabs = readOnly ? TABS.filter((t) => t.key !== "pagos") : TABS;

  return (
    <div className="rounded-xl border border-line bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <div className="text-lg font-semibold tracking-tight">{property.address}</div>
          <div className="font-mono text-xs text-neutral-400">
            {property.permit_number ?? "Sin permiso"}
            {property.workflow_started && ` · Workflow: ${property.workflow_started}`}
          </div>
        </div>
        <div className="inline-flex rounded-lg border border-line p-1 text-sm">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={clsx(
                "rounded-md px-3 py-1.5 font-medium transition-colors",
                tab === t.key
                  ? "bg-brand text-white"
                  : "text-neutral-500 hover:text-neutral-800",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-5">
        {tab === "planos" && <PlanosTab property={property} readOnly={readOnly} />}
        {tab === "docs" && <DocumentosTab propertyId={property.id} readOnly={readOnly} />}
        {tab === "pagos" && !readOnly && <PaymentsManager scope="property" propertyId={property.id} propertyAddress={property.address} />}
      </div>
    </div>
  );
}

function PlanosTab({ property, readOnly = false }: { property: PropertyWithStats; readOnly?: boolean }) {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [commentsByDisc, setCommentsByDisc] = useState<Record<string, Comment[]>>({});
  const [tracking, setTracking] = useState<Record<string, CommentTracking>>({});
  const [cycleOpen, setCycleOpen] = useState<Set<number>>(new Set());
  const [discFilter, setDiscFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"pending" | "resolved" | "all">("pending");
  const [drawer, setDrawer] = useState<{ comment: Comment; discipline: Discipline } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const { data: disc, error: dErr } = await supabase
        .from("disciplines")
        .select("*")
        .eq("property_id", property.id)
        .order("sort_order", { nullsFirst: false });
      if (dErr) {
        if (!cancelled) { setError(dErr.message); setLoading(false); }
        return;
      }
      const discList = (disc ?? []) as Discipline[];
      const discIds = discList.map((d) => d.id);

      let comments: Comment[] = [];
      if (discIds.length) {
        const { data: cData, error: cErr } = await supabase
          .from("comments")
          .select("*")
          .in("discipline_id", discIds)
          .order("ref_number", { nullsFirst: false });
        if (cErr) {
          if (!cancelled) { setError(cErr.message); setLoading(false); }
          return;
        }
        comments = (cData ?? []) as Comment[];
      }

      const commentIds = comments.map((c) => c.id);
      let track: CommentTracking[] = [];
      if (commentIds.length) {
        const { data: tData } = await supabase
          .from("comment_tracking")
          .select("*")
          .in("comment_id", commentIds);
        track = (tData ?? []) as CommentTracking[];
      }

      if (cancelled) return;
      const grouped: Record<string, Comment[]> = {};
      for (const c of comments) (grouped[c.discipline_id] ??= []).push(c);
      const trackMap: Record<string, CommentTracking> = {};
      for (const t of track) trackMap[t.comment_id] = t;

      setDisciplines(discList);
      setCommentsByDisc(grouped);
      setTracking(trackMap);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [property.id, supabase]);

  // upsert a patch onto a comment's tracking row (create it if missing)
  async function updateTracking(commentId: string, patch: Partial<CommentTracking>) {
    const existing = tracking[commentId];
    if (existing) {
      const { data } = await supabase.from("comment_tracking").update(patch).eq("id", existing.id).select().single();
      if (data) setTracking((prev) => ({ ...prev, [commentId]: data as CommentTracking }));
    } else {
      const { data } = await supabase.from("comment_tracking").insert({ comment_id: commentId, internal_status: "Pending", ...patch }).select().single();
      if (data) setTracking((prev) => ({ ...prev, [commentId]: data as CommentTracking }));
    }
  }

  if (loading) return <div className="py-8 text-center text-sm text-neutral-400">Cargando…</div>;
  if (error)
    return <div className="py-4 text-sm text-[#a32d2d]">Error: {error}</div>;
  if (!disciplines.length)
    return (
      <div className="py-6 text-sm text-neutral-500">
        Esta propiedad aún no tiene disciplinas en iBuild.
      </div>
    );

  const totalNow = disciplines.reduce((s, d) => s + d.total_comments, 0);
  const openNow = disciplines.reduce((s, d) => s + d.open_comments, 0);
  const infoNow = disciplines.reduce((s, d) => s + d.info_comments, 0);
  const resolvedNow = Math.max(0, totalNow - openNow - infoNow);

  // resueltos agrupados por el ciclo del reporte (comments.cycle)
  const discById = new Map(disciplines.map((d) => [d.id, d]));
  const allComments = Object.values(commentsByDisc).flat();
  const maxCycle = allComments.reduce((m, c) => Math.max(m, c.cycle ?? 0), 0);
  const resolvedByCycle = new Map<number, Comment[]>();
  for (const c of allComments) {
    if (c.city_status !== "Resolved") continue;
    const k = c.cycle ?? 0; // 0 = sin ciclo (dato viejo)
    if (!resolvedByCycle.has(k)) resolvedByCycle.set(k, []);
    resolvedByCycle.get(k)!.push(c);
  }
  const cycleKeys = [...resolvedByCycle.keys()].sort((a, b) => b - a);

  const discName = (id: string) => discById.get(id)?.name ?? discById.get(id)?.code ?? "—";
  // comments for the editable table, filtered by discipline + status
  const filteredComments = allComments
    .filter((c) => discFilter === "all" || c.discipline_id === discFilter)
    .filter((c) => (statusFilter === "all" ? true : statusFilter === "resolved" ? c.city_status === "Resolved" : c.city_status === "Unresolved"))
    .sort((a, b) => discName(a.discipline_id).localeCompare(discName(b.discipline_id)) || (a.ref_number ?? 0) - (b.ref_number ?? 0));

  // línea de comentario con disciplina (nombre completo: Public Works, Environmental, etc.)
  const commentLine = (c: Comment) => {
    const t = tracking[c.id];
    return (
      <li key={c.id} className="flex items-start gap-2 px-3 py-2">
        <span className="w-9 shrink-0 font-mono text-xs text-neutral-400">#{c.ref_number}</span>
        <span className="w-28 shrink-0 text-[11px] font-medium text-neutral-500">
          <span className="mr-1 rounded bg-brand/10 px-1 text-[10px] font-semibold text-brand">{discById.get(c.discipline_id)?.code}</span>
          {discName(c.discipline_id)}
        </span>
        <span className="flex-1 text-xs text-neutral-600">{c.text}</span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          {t?.assignee && <AssigneeChip name={t.assignee} />}
          {t?.assignee2 && <AssigneeChip name={t.assignee2} />}
        </span>
      </li>
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <button
          onClick={() => window.print()}
          className="rounded-md border border-line px-3 py-1.5 text-sm font-medium text-neutral-600 hover:bg-page"
        >
          Exportar PDF
        </button>
      </div>

      {/* Comentarios resueltos por ciclo (del reporte de iBuild) */}
      <div className="rounded-lg border border-line bg-page/40 px-4 py-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-sm font-semibold">
            Comentarios resueltos por ciclo
            {maxCycle > 0 && <span className="ml-1 font-normal text-neutral-400">· ciclo actual {maxCycle}</span>}
          </span>
          <span className="text-xs text-neutral-500">
            Ahora: <span className="font-semibold text-[#3b6d11]">{resolvedNow}</span> resueltos ·{" "}
            <span className="font-semibold text-[#a32d2d]">{openNow}</span> pendientes de {totalNow}
            {infoNow > 0 && <span className="text-neutral-400"> · {infoNow} info</span>}
          </span>
        </div>
        {cycleKeys.length === 0 ? (
          <p className="mt-1.5 text-xs text-neutral-400">
            Todavía no hay comentarios resueltos registrados. Se completan al importar el reporte de iBuild.
          </p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {cycleKeys.map((n) => {
              const list = resolvedByCycle.get(n)!.slice().sort((a, b) => (a.ref_number ?? 0) - (b.ref_number ?? 0));
              const isOpen = cycleOpen.has(n);
              return (
                <li key={n} className="rounded-md border border-line bg-card">
                  <button
                    onClick={() => setCycleOpen((prev) => { const s = new Set(prev); s.has(n) ? s.delete(n) : s.add(n); return s; })}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-page/60"
                  >
                    <span className="text-sm font-medium text-neutral-700">{n === 0 ? "Sin ciclo asignado" : `Ciclo ${n}`}</span>
                    <span className="flex items-center gap-2 text-xs">
                      <span className="font-semibold text-[#3b6d11]">✓ {list.length} resueltos</span>
                      <svg className={clsx("h-4 w-4 text-neutral-400 transition-transform", isOpen && "rotate-90")} viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                      </svg>
                    </span>
                  </button>
                  {isOpen && (
                    <ul className="divide-y divide-line border-t border-line">
                      {list.map((c) => commentLine(c))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Discipline overview — resumen (no se abre) */}
      <div className="overflow-hidden rounded-lg border border-line">
        <div className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 bg-page px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-neutral-400">
          <span className="w-8">Cód.</span>
          <span>Disciplina / Revisor</span>
          <span>Estado ciudad</span>
          <span className="text-right">Abiertos</span>
        </div>
        {disciplines.map((d) => (
          <div key={d.id} className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 border-t border-line px-4 py-3">
            <span className="grid h-7 w-8 place-items-center rounded bg-brand/10 text-xs font-semibold text-brand">{d.code}</span>
            <span>
              <span className="font-medium">{d.name}</span>
              <span className="ml-2 text-xs text-neutral-400">{d.reviewer_name}</span>
            </span>
            <DisciplineStatusBadge status={d.city_status} />
            <span className="flex items-center justify-end gap-1 text-sm">
              <span className={clsx("font-semibold", d.open_comments > 0 ? "text-[#a32d2d]" : "text-neutral-400")}>{d.open_comments}</span>
              <span className="text-neutral-300">/ {d.total_comments}</span>
            </span>
          </div>
        ))}
      </div>

      {/* Comentarios — planilla editable con filtros */}
      <div>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold">Comentarios</span>
          <select value={discFilter} onChange={(e) => setDiscFilter(e.target.value)} className="rounded-md border border-line bg-card px-2 py-1 text-xs outline-none focus:border-brand">
            <option value="all">Todas las disciplinas</option>
            {disciplines.map((d) => (<option key={d.id} value={d.id}>{d.code} — {d.name}</option>))}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as "pending" | "resolved" | "all")} className="rounded-md border border-line bg-card px-2 py-1 text-xs outline-none focus:border-brand">
            <option value="pending">Pendientes</option>
            <option value="resolved">Resueltos</option>
            <option value="all">Todos</option>
          </select>
          <span className="text-xs text-neutral-400">{filteredComments.length} comentarios</span>
        </div>
        {filteredComments.length === 0 ? (
          <div className="rounded-lg border border-line py-6 text-center text-sm text-neutral-400">Ningún comentario con estos filtros.</div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-line">
            <table className="w-full min-w-[1240px] text-sm">
              <thead>
                <tr className="bg-page text-left text-[10px] font-medium uppercase tracking-wide text-neutral-400">
                  <th className="px-2 py-2">#</th>
                  <th className="px-2 py-2">Disc.</th>
                  <th className="px-2 py-2">Comentario original</th>
                  <th className="px-2 py-2">Diálogo (ciudad ↔ nosotros)</th>
                  <th className="px-2 py-2">Quién 1</th>
                  <th className="px-2 py-2">Quién 2</th>
                  <th className="px-2 py-2">Estado</th>
                  <th className="px-2 py-2">Respuesta final</th>
                </tr>
              </thead>
              <tbody>
                {filteredComments.map((c) => (
                  <CommentRow
                    key={c.id}
                    comment={c}
                    disc={discById.get(c.discipline_id) ?? null}
                    tracking={tracking[c.id] ?? null}
                    readOnly={readOnly}
                    onPatch={(patch) => updateTracking(c.id, patch)}
                    onOpenHistory={() => { const dd = discById.get(c.discipline_id); if (dd) setDrawer({ comment: c, discipline: dd }); }}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {drawer && (
        <CommentDrawer
          comment={drawer.comment}
          discipline={drawer.discipline}
          tracking={tracking[drawer.comment.id] ?? null}
          readOnly={readOnly}
          onClose={() => setDrawer(null)}
          onSaved={(t) => setTracking((prev) => ({ ...prev, [t.comment_id]: t }))}
        />
      )}
    </div>
  );
}

// Small colored chip showing who a comment is assigned to (Owner / David / …).
function AssigneeChip({ name }: { name: string }) {
  const c = respColor(name);
  return <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold" style={{ color: c.color, backgroundColor: c.bg }}>👤 {name}</span>;
}

// Preset responsables for the quick-assign dropdowns (+ free text via "Otro…").
const RESP_OPTIONS = ["ARCH", "STR", "CIVIL", "MECHA", "ELEC", "PLUMB", "LANDSC", "OWNER", "RUNNER"];
function respColor(v: string): { color: string; bg: string } {
  const u = (v || "").trim().toUpperCase();
  if (u === "OWNER") return { color: "#8a6d00", bg: "#fbf3d0" };
  if (u === "RUNNER") return { color: "#3b6d11", bg: "#eaf3de" };
  if (v && v.trim()) return { color: "#1b3a6b", bg: "#e7eef8" };
  return { color: "#737373", bg: "#ffffff" };
}

function AssigneePicker({ value, onChange, readOnly = false }: { value: string; onChange: (v: string | null) => void; readOnly?: boolean }) {
  const cur = (value ?? "").trim();
  const known = RESP_OPTIONS.includes(cur.toUpperCase());
  if (readOnly) return cur ? <AssigneeChip name={cur} /> : <span className="text-[10px] text-neutral-300">—</span>;
  const c = respColor(cur);
  return (
    <select
      value={known ? cur.toUpperCase() : cur ? "__cur__" : ""}
      onChange={(e) => {
        const v = e.target.value;
        if (v === "__otro__") { const t = window.prompt("Responsable (ej: nombre del ingeniero):", cur); if (t && t.trim()) onChange(t.trim()); }
        else if (v === "__cur__") { /* keep current custom value */ }
        else onChange(v || null);
      }}
      title="Responsable"
      style={{ color: c.color, backgroundColor: c.bg }}
      className="w-full rounded border border-line px-1 py-0.5 text-[11px] font-semibold outline-none focus:border-brand"
    >
      <option value="">—</option>
      {RESP_OPTIONS.map((o) => (<option key={o} value={o}>{o}</option>))}
      {cur && !known && <option value="__cur__">{cur}</option>}
      <option value="__otro__">＋ Otro…</option>
    </select>
  );
}

// Editable multi-line cell that saves on blur (Diálogo / Respuesta final).
function EditableCell({ value, onSave, readOnly, placeholder }: { value: string; onSave: (v: string) => void; readOnly: boolean; placeholder: string }) {
  const [v, setV] = useState(value);
  useEffect(() => { setV(value); }, [value]);
  if (readOnly) return <div className="min-w-[180px] whitespace-pre-wrap text-xs text-neutral-600">{value || "—"}</div>;
  return (
    <textarea
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => { if (v.trim() !== (value ?? "").trim()) onSave(v.trim()); }}
      rows={3}
      placeholder={placeholder}
      className="min-w-[190px] w-full resize-y rounded border border-line bg-card px-1.5 py-1 text-xs outline-none focus:border-brand"
    />
  );
}

// Split the iBuild comment text into the original comment and the city↔us dialogue.
function splitComment(text: string | null): { original: string; dialogue: string } {
  const t = text ?? "";
  const idx = t.search(/Reviewer Response:/i);
  if (idx < 0) return { original: t.trim(), dialogue: "" };
  return { original: t.slice(0, idx).trim(), dialogue: t.slice(idx).trim() };
}

function CommentRow({
  comment, disc, tracking, readOnly, onPatch, onOpenHistory,
}: {
  comment: Comment;
  disc: Discipline | null;
  tracking: CommentTracking | null;
  readOnly: boolean;
  onPatch: (patch: Partial<CommentTracking>) => void;
  onOpenHistory: () => void;
}) {
  const t = tracking;
  const { original, dialogue } = splitComment(comment.text);
  return (
    <tr className="border-t border-line align-top">
      <td className="px-2 py-2">
        <button onClick={onOpenHistory} title="Ver historial / notas del comentario" className="font-mono text-xs font-medium text-brand hover:underline">#{comment.ref_number}</button>
      </td>
      <td className="px-2 py-2">
        <span title={disc?.name ?? ""} className="rounded bg-brand/10 px-1 text-[10px] font-semibold text-brand">{disc?.code ?? "—"}</span>
      </td>
      <td className="px-2 py-2">
        <div className="max-h-36 min-w-[260px] max-w-[360px] overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed text-neutral-700">{original}</div>
      </td>
      <td className="px-2 py-2">
        <div className="max-h-36 min-w-[260px] max-w-[360px] overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed text-neutral-500">{dialogue || "—"}</div>
      </td>
      <td className="w-24 px-2 py-2"><AssigneePicker value={t?.assignee ?? ""} readOnly={readOnly} onChange={(v) => onPatch({ assignee: v })} /></td>
      <td className="w-24 px-2 py-2"><AssigneePicker value={t?.assignee2 ?? ""} readOnly={readOnly} onChange={(v) => onPatch({ assignee2: v })} /></td>
      <td className="w-28 px-2 py-2">
        <div className="flex flex-col items-start gap-1">
          <CommentStatusBadge status={comment.city_status} />
          {readOnly ? (
            t && <InternalStatusBadge status={t.internal_status} />
          ) : (
            <select
              value={t?.internal_status ?? "Pending"}
              onChange={(e) => onPatch({ internal_status: e.target.value as InternalStatus })}
              className="w-full rounded border border-line bg-card px-1 py-0.5 text-[10px] outline-none focus:border-brand"
            >
              {INTERNAL_STATUSES.map((s) => (<option key={s} value={s}>{s}</option>))}
            </select>
          )}
        </div>
      </td>
      <td className="px-2 py-2"><EditableCell value={t?.final_response ?? ""} readOnly={readOnly} placeholder="Cómo se resolvió / respuesta final…" onSave={(v) => onPatch({ final_response: v || null })} /></td>
    </tr>
  );
}
