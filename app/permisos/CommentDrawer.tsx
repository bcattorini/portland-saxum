"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  Comment,
  CommentTracking,
  Discipline,
  InternalStatus,
  TrackingHistory,
} from "@/lib/types";
import { INTERNAL_STATUSES } from "@/lib/types";
import { CommentStatusBadge, InternalStatusBadge } from "@/lib/badges";

export function CommentDrawer({
  comment,
  discipline,
  tracking,
  onClose,
  onSaved,
}: {
  comment: Comment;
  discipline: Discipline;
  tracking: CommentTracking | null;
  onClose: () => void;
  onSaved: (t: CommentTracking) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [assignee, setAssignee] = useState(tracking?.assignee ?? "");
  const [status, setStatus] = useState<InternalStatus>(tracking?.internal_status ?? "Pending");
  const [notes, setNotes] = useState(tracking?.notes ?? "");
  const [history, setHistory] = useState<TrackingHistory[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("tracking_history")
        .select("*")
        .eq("comment_id", comment.id)
        .order("changed_at", { ascending: false });
      if (!cancelled) setHistory((data ?? []) as TrackingHistory[]);
    })();
    return () => { cancelled = true; };
  }, [comment.id, supabase]);

  async function save() {
    setSaving(true);
    setSaveError(null);
    const payload = {
      comment_id: comment.id,
      assignee: assignee.trim() || null,
      internal_status: status,
      notes: notes.trim() || null,
    };
    const { data: upserted, error } = await supabase
      .from("comment_tracking")
      .upsert(payload, { onConflict: "comment_id" })
      .select()
      .single();

    if (error) {
      setSaveError(error.message);
      setSaving(false);
      return;
    }

    // Append an audit snapshot (never overwritten)
    const { data: hist } = await supabase
      .from("tracking_history")
      .insert({
        comment_id: comment.id,
        assignee: payload.assignee,
        internal_status: payload.internal_status,
        notes: payload.notes,
      })
      .select()
      .single();

    if (hist) setHistory((prev) => [hist as TrackingHistory, ...prev]);
    onSaved(upserted as CommentTracking);
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-md flex-col overflow-y-auto bg-card shadow-xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-neutral-400">
              <span className="rounded bg-brand/10 px-1.5 py-0.5 font-semibold text-brand">
                {discipline.code}
              </span>
              <span>{discipline.name}</span>
              <span className="font-mono">#{comment.ref_number}</span>
            </div>
            <div className="mt-2">
              <CommentStatusBadge status={comment.city_status} />
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-neutral-400 hover:bg-page hover:text-neutral-700"
            aria-label="Cerrar"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        <div className="flex-1 space-y-6 px-5 py-5">
          {/* Verbatim City comment (English, read-only) */}
          <div>
            <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-neutral-400">
              Comentario de la ciudad (iBuild)
            </div>
            <p className="text-sm leading-relaxed text-neutral-800">{comment.text}</p>
            {comment.filename && (
              <div className="mt-2 font-mono text-xs text-neutral-400">{comment.filename}</div>
            )}
          </div>

          {/* Internal tracking editor */}
          <div className="space-y-3 rounded-lg border border-line p-4">
            <div className="text-[11px] font-medium uppercase tracking-wide text-neutral-400">
              Seguimiento interno
            </div>
            <label className="block">
              <span className="text-xs text-neutral-500">Responsable</span>
              <input
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                placeholder="Ej: David, Dueño…"
                className="mt-1 w-full rounded-md border border-line px-3 py-1.5 text-sm outline-none focus:border-brand"
              />
            </label>
            <label className="block">
              <span className="text-xs text-neutral-500">Nuestro estado</span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as InternalStatus)}
                className="mt-1 w-full rounded-md border border-line bg-card px-3 py-1.5 text-sm outline-none focus:border-brand"
              >
                {INTERNAL_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs text-neutral-500">Notas</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Notas internas en español…"
                className="mt-1 w-full resize-y rounded-md border border-line px-3 py-1.5 text-sm outline-none focus:border-brand"
              />
            </label>
            {saveError && <div className="text-xs text-[#a32d2d]">Error: {saveError}</div>}
            <button
              onClick={save}
              disabled={saving}
              className="w-full rounded-md bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-60"
            >
              {saving ? "Guardando…" : "Guardar seguimiento"}
            </button>
          </div>

          {/* History log */}
          <div>
            <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-neutral-400">
              Historial ({history.length})
            </div>
            {history.length === 0 ? (
              <div className="text-xs text-neutral-400">Sin cambios registrados todavía.</div>
            ) : (
              <ul className="space-y-2">
                {history.map((h) => (
                  <li key={h.id} className="rounded-md border border-line px-3 py-2 text-xs">
                    <div className="flex items-center justify-between">
                      {h.internal_status ? (
                        <InternalStatusBadge status={h.internal_status} />
                      ) : (
                        <span className="text-neutral-400">—</span>
                      )}
                      <span className="text-neutral-400">
                        {new Date(h.changed_at).toLocaleString("es")}
                      </span>
                    </div>
                    {h.assignee && (
                      <div className="mt-1 text-neutral-500">Responsable: {h.assignee}</div>
                    )}
                    {h.notes && <div className="mt-1 text-neutral-600">{h.notes}</div>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
