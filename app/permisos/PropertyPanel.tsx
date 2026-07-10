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
import { PagosTab } from "./PagosTab";

type Tab = "planos" | "docs" | "pagos";

const TABS: { key: Tab; label: string }[] = [
  { key: "planos", label: "Planos & Ciudad" },
  { key: "docs", label: "Documentos" },
  { key: "pagos", label: "Pagos" },
];

export function PropertyPanel({ property }: { property: PropertyWithStats }) {
  const [tab, setTab] = useState<Tab>("planos");

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
          {TABS.map((t) => (
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
        {tab === "planos" && <PlanosTab property={property} />}
        {tab === "docs" && <DocumentosTab propertyId={property.id} />}
        {tab === "pagos" && <PagosTab propertyId={property.id} propertyAddress={property.address} />}
      </div>
    </div>
  );
}

function PlanosTab({ property }: { property: PropertyWithStats }) {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [commentsByDisc, setCommentsByDisc] = useState<Record<string, Comment[]>>({});
  const [tracking, setTracking] = useState<Record<string, CommentTracking>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
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
                                {t && <InternalStatusBadge status={t.internal_status} />}
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
          onClose={() => setDrawer(null)}
          onSaved={(t) => setTracking((prev) => ({ ...prev, [t.comment_id]: t }))}
        />
      )}
    </div>
  );
}
