"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { createClient } from "@/lib/supabase/client";
import type {
  Comment,
  CommentTracking,
  Discipline,
  PropertyWithStats,
} from "@/lib/types";
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
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [cycleOpen, setCycleOpen] = useState<Set<number>>(new Set());
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

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
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

  // pendientes por resolver (Unresolved), ordenados por disciplina y luego ref
  const discName = (id: string) => discById.get(id)?.name ?? discById.get(id)?.code ?? "—";
  const pending = allComments
    .filter((c) => c.city_status === "Unresolved")
    .sort((a, b) => discName(a.discipline_id).localeCompare(discName(b.discipline_id)) || (a.ref_number ?? 0) - (b.ref_number ?? 0));

  // línea de comentario con disciplina (nombre completo: Public Works, Environmental, etc.)
  const commentLine = (c: Comment) => (
    <li key={c.id} className="flex items-start gap-2 px-3 py-2">
      <span className="w-9 shrink-0 font-mono text-xs text-neutral-400">#{c.ref_number}</span>
      <span className="w-28 shrink-0 text-[11px] font-medium text-neutral-500">
        <span className="mr-1 rounded bg-brand/10 px-1 text-[10px] font-semibold text-brand">{discById.get(c.discipline_id)?.code}</span>
        {discName(c.discipline_id)}
      </span>
      <span className="flex-1 text-xs text-neutral-600">{c.text}</span>
    </li>
  );

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

      {/* Comentarios pendientes por resolver (Unresolved) */}
      <div className="rounded-lg border border-line bg-page/40 px-4 py-3">
        <button
          onClick={() => setCycleOpen((prev) => { const s = new Set(prev); s.has(-1) ? s.delete(-1) : s.add(-1); return s; })}
          className="flex w-full items-center justify-between gap-2 text-left"
        >
          <span className="text-sm font-semibold">
            Pendientes por resolver
            {maxCycle > 0 && <span className="ml-1 font-normal text-neutral-400">· ciclo actual {maxCycle}</span>}
          </span>
          <span className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-[#a32d2d]">{pending.length} pendientes</span>
            <svg className={clsx("h-4 w-4 text-neutral-400 transition-transform", cycleOpen.has(-1) && "rotate-90")} viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
            </svg>
          </span>
        </button>
        {cycleOpen.has(-1) && (
          pending.length === 0 ? (
            <p className="mt-1.5 text-xs text-neutral-400">No quedan comentarios abiertos. 🎉</p>
          ) : (
            <ul className="mt-2 divide-y divide-line rounded-md border border-line bg-card">
              {pending.map((c) => commentLine(c))}
            </ul>
          )
        )}
      </div>

      {/* Discipline table */}
      <div className="overflow-hidden rounded-lg border border-line">
        <div className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 bg-page px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-neutral-400">
          <span className="w-8">Cód.</span>
          <span>Disciplina / Revisor</span>
          <span>Estado ciudad</span>
          <span className="text-right">Abiertos</span>
        </div>
        {disciplines.map((d) => {
          const isOpen = expanded.has(d.id);
          const comments = commentsByDisc[d.id] ?? [];
          return (
            <div key={d.id} className="border-t border-line first:border-t-0">
              <button
                onClick={() => toggle(d.id)}
                className="grid w-full grid-cols-[auto_1fr_auto_auto] items-center gap-3 px-4 py-3 text-left hover:bg-page/60"
              >
                <span className="grid h-7 w-8 place-items-center rounded bg-brand/10 text-xs font-semibold text-brand">
                  {d.code}
                </span>
                <span>
                  <span className="font-medium">{d.name}</span>
                  <span className="ml-2 text-xs text-neutral-400">{d.reviewer_name}</span>
                </span>
                <DisciplineStatusBadge status={d.city_status} />
                <span className="flex items-center justify-end gap-2 text-sm">
                  <span className={clsx("font-semibold", d.open_comments > 0 ? "text-[#a32d2d]" : "text-neutral-400")}>
                    {d.open_comments}
                  </span>
                  <span className="text-neutral-300">/ {d.total_comments}</span>
                  <svg
                    className={clsx("h-4 w-4 text-neutral-400 transition-transform", isOpen && "rotate-90")}
                    viewBox="0 0 20 20" fill="currentColor"
                  >
                    <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                  </svg>
                </span>
              </button>

              {isOpen && (
                <div className="border-t border-line bg-page/30 px-4 py-2">
                  {comments.length === 0 ? (
                    <div className="py-3 text-xs text-neutral-400">
                      Sin comentarios detallados. (Header: {d.open_comments} abiertos, {d.info_comments} info.)
                    </div>
                  ) : (
                    <ul className="divide-y divide-line">
                      {comments.map((c) => {
                        const t = tracking[c.id];
                        return (
                          <li key={c.id}>
                            <button
                              onClick={() => setDrawer({ comment: c, discipline: d })}
                              className="flex w-full items-start gap-3 py-2.5 text-left hover:bg-card"
                            >
                              <span className="mt-0.5 w-10 shrink-0 font-mono text-xs text-neutral-400">
                                #{c.ref_number}
                              </span>
                              <span className="flex-1 text-sm text-neutral-700">
                                {c.text}
                              </span>
                              <span className="flex shrink-0 flex-col items-end gap-1">
                                <CommentStatusBadge status={c.city_status} />
                                {t?.finalized_at ? (
                                  <span className="badge badge-success">✓ Finalizado</span>
                                ) : (
                                  t && <InternalStatusBadge status={t.internal_status} />
                                )}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}
            </div>
          );
        })}
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
