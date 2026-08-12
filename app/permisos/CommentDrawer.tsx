"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { personForEmail } from "@/lib/users";
import type { Comment, CommentNote, CommentTracking, Discipline, InternalStatus } from "@/lib/types";
import { INTERNAL_STATUSES } from "@/lib/types";
import { CommentStatusBadge } from "@/lib/badges";

const fmtDT = (iso: string) =>
  new Date(iso).toLocaleString("es", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

export function CommentDrawer({
  comment,
  discipline,
  tracking,
  readOnly = false,
  onClose,
  onSaved,
}: {
  comment: Comment;
  discipline: Discipline;
  tracking: CommentTracking | null;
  readOnly?: boolean;
  onClose: () => void;
  onSaved: (t: CommentTracking) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [assignee, setAssignee] = useState(tracking?.assignee ?? "");
  const [status, setStatus] = useState<InternalStatus>(tracking?.internal_status ?? "Pending");
  const [finalizedAt, setFinalizedAt] = useState<string | null>(tracking?.finalized_at ?? null);
  const legacyNotes = tracking?.notes ?? null;
  const [notesList, setNotesList] = useState<CommentNote[]>([]);
  const [newNote, setNewNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [addingNote, setAddingNote] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authorName, setAuthorName] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setAuthorName(personForEmail(data.user?.email)?.name ?? data.user?.email ?? null);
    });
  }, [supabase]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("comment_notes")
        .select("*")
        .eq("comment_id", comment.id)
        .order("created_at", { ascending: false });
      if (!cancelled) setNotesList((data ?? []) as CommentNote[]);
    })();
    return () => { cancelled = true; };
  }, [comment.id, supabase]);

  async function persistTracking(over: Partial<CommentTracking> = {}) {
    setError(null);
    const payload = {
      comment_id: comment.id,
      assignee: assignee.trim() || null,
      internal_status: status,
      notes: legacyNotes,
      finalized_at: finalizedAt,
      ...over,
    };
    const { data, error } = await supabase
      .from("comment_tracking")
      .upsert(payload, { onConflict: "comment_id" })
      .select()
      .single();
    if (error) { setError(error.message); return null; }
    onSaved(data as CommentTracking);
    return data as CommentTracking;
  }

  async function saveTracking() {
    setSaving(true);
    await persistTracking();
    setSaving(false);
  }
  async function finalize() {
    setSaving(true);
    const t = await persistTracking({ finalized_at: new Date().toISOString() });
    if (t) setFinalizedAt(t.finalized_at);
    setSaving(false);
  }
  async function reopen() {
    setSaving(true);
    const t = await persistTracking({ finalized_at: null });
    if (t) setFinalizedAt(t.finalized_at);
    setSaving(false);
  }
  async function addNote() {
    if (!newNote.trim()) return;
    setAddingNote(true);
    setError(null);
    const { data, error } = await supabase
      .from("comment_notes")
      .insert({ comment_id: comment.id, body: newNote.trim(), created_by: authorName })
      .select()
      .single();
    if (error) setError(error.message);
    else if (data) { setNotesList((prev) => [data as CommentNote, ...prev]); setNewNote(""); }
    setAddingNote(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-md flex-col overflow-y-auto bg-card shadow-xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-neutral-400">
              <span className="rounded bg-brand/10 px-1.5 py-0.5 font-semibold text-brand">{discipline.code}</span>
              <span>{discipline.name}</span>
              <span className="font-mono">#{comment.ref_number}</span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <CommentStatusBadge status={comment.city_status} />
              {finalizedAt && <span className="badge badge-success">✓ Finalizado</span>}
            </div>
          </div>
          <button onClick={onClose} className="rounded p-1 text-neutral-400 hover:bg-page hover:text-neutral-700" aria-label="Cerrar">
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        <div className="flex-1 space-y-6 px-5 py-5">
          {/* Verbatim City comment */}
          <div>
            <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-neutral-400">Comentario de la ciudad (iBuild)</div>
            <p className="text-sm leading-relaxed text-neutral-800">{comment.text}</p>
            {comment.filename && <div className="mt-2 font-mono text-xs text-neutral-400">{comment.filename}</div>}
          </div>

          {/* Tracking: responsable + estado + finalizar */}
          <div className="space-y-3 rounded-lg border border-line p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium uppercase tracking-wide text-neutral-400">Seguimiento interno</span>
              {!readOnly && (finalizedAt ? (
                <button onClick={reopen} disabled={saving} className="text-xs font-medium text-brand hover:underline disabled:opacity-50">Reabrir</button>
              ) : (
                <button onClick={finalize} disabled={saving} className="rounded-md bg-[#eaf3de] px-2.5 py-1 text-xs font-medium text-[#3b6d11] hover:bg-[#dfeecb] disabled:opacity-50">
                  ✓ Finalizar seguimiento
                </button>
              ))}
            </div>
            {finalizedAt && (
              <div className="rounded-md bg-[#eaf3de] px-3 py-1.5 text-xs text-[#3b6d11]">Finalizado el {fmtDT(finalizedAt)}</div>
            )}
            {readOnly ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <span className="text-xs text-neutral-500">Responsable</span>
                  <div className="mt-1 text-sm text-neutral-800">{assignee || "—"}</div>
                </div>
                <div>
                  <span className="text-xs text-neutral-500">Nuestro estado</span>
                  <div className="mt-1 text-sm text-neutral-800">{status}</div>
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-xs text-neutral-500">Responsable</span>
                    <input value={assignee} onChange={(e) => setAssignee(e.target.value)} placeholder="Ej: David, Owner…"
                      className="mt-1 w-full rounded-md border border-line px-3 py-1.5 text-sm outline-none focus:border-brand" />
                  </label>
                  <label className="block">
                    <span className="text-xs text-neutral-500">Nuestro estado</span>
                    <select value={status} onChange={(e) => setStatus(e.target.value as InternalStatus)}
                      className="mt-1 w-full rounded-md border border-line bg-card px-3 py-1.5 text-sm outline-none focus:border-brand">
                      {INTERNAL_STATUSES.map((s) => (<option key={s} value={s}>{s}</option>))}
                    </select>
                  </label>
                </div>
                {error && <div className="text-xs text-[#a32d2d]">Error: {error}</div>}
                <button onClick={saveTracking} disabled={saving}
                  className="w-full rounded-md bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-60">
                  {saving ? "Guardando…" : "Guardar responsable / estado"}
                </button>
              </>
            )}
          </div>

          {/* Registro fechado de notas */}
          <div>
            <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-neutral-400">Registro de seguimiento ({notesList.length})</div>
            {!readOnly && (
              <div className="rounded-lg border border-line p-3">
                <textarea value={newNote} onChange={(e) => setNewNote(e.target.value)} rows={2} placeholder="Nueva nota… (se guarda con fecha)"
                  className="w-full resize-y rounded-md border border-line px-3 py-1.5 text-sm outline-none focus:border-brand" />
                <div className="mt-2 flex justify-end">
                  <button onClick={addNote} disabled={addingNote || !newNote.trim()}
                    className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50">
                    {addingNote ? "Agregando…" : "Agregar nota"}
                  </button>
                </div>
              </div>
            )}

            {notesList.length === 0 ? (
              <div className="mt-3 text-xs text-neutral-400">Sin notas todavía. Agregá la primera arriba.</div>
            ) : (
              <ul className="mt-3 space-y-2">
                {notesList.map((n) => (
                  <li key={n.id} className="rounded-md border border-line px-3 py-2">
                    <div className="flex items-center justify-between text-[11px] text-neutral-400">
                      <span>{fmtDT(n.created_at)}</span>
                      {n.created_by && <span>{n.created_by}</span>}
                    </div>
                    <div className="mt-1 whitespace-pre-wrap text-sm text-neutral-700">{n.body}</div>
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
