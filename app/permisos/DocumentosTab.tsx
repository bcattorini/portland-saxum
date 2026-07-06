"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { createClient } from "@/lib/supabase/client";
import type { DocumentStatus, PropertyDocument } from "@/lib/types";
import { DOCUMENT_STATUSES } from "@/lib/types";
import { DocumentStatusBadge } from "@/lib/badges";

type Draft = {
  title: string;
  status: DocumentStatus;
  assignee: string;
  due_date: string;
  description: string;
  notes: string;
};

const emptyDraft: Draft = {
  title: "",
  status: "Pending",
  assignee: "",
  due_date: "",
  description: "",
  notes: "",
};

function toDraft(d: PropertyDocument): Draft {
  return {
    title: d.title,
    status: d.status,
    assignee: d.assignee ?? "",
    due_date: d.due_date ?? "",
    description: d.description ?? "",
    notes: d.notes ?? "",
  };
}

function draftToRow(dr: Draft) {
  return {
    title: dr.title.trim(),
    status: dr.status,
    assignee: dr.assignee.trim() || null,
    due_date: dr.due_date || null,
    description: dr.description.trim() || null,
    notes: dr.notes.trim() || null,
  };
}

export function DocumentosTab({ propertyId }: { propertyId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [docs, setDocs] = useState<PropertyDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("property_documents")
        .select("*")
        .eq("property_id", propertyId)
        .order("sort_order", { nullsFirst: false })
        .order("created_at");
      if (cancelled) return;
      if (error) setError(error.message);
      else setDocs((data ?? []) as PropertyDocument[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [propertyId, supabase]);

  async function saveEdit(id: string, dr: Draft) {
    const { data, error } = await supabase
      .from("property_documents")
      .update(draftToRow(dr))
      .eq("id", id)
      .select()
      .single();
    if (error) return error.message;
    setDocs((prev) => prev.map((d) => (d.id === id ? (data as PropertyDocument) : d)));
    setEditingId(null);
    return null;
  }

  async function addDoc(dr: Draft) {
    const nextSort = (docs.reduce((m, d) => Math.max(m, d.sort_order ?? 0), 0) || 0) + 1;
    const { data, error } = await supabase
      .from("property_documents")
      .insert({ property_id: propertyId, sort_order: nextSort, ...draftToRow(dr) })
      .select()
      .single();
    if (error) return error.message;
    setDocs((prev) => [...prev, data as PropertyDocument]);
    setAdding(false);
    return null;
  }

  async function remove(id: string) {
    const { error } = await supabase.from("property_documents").delete().eq("id", id);
    if (!error) setDocs((prev) => prev.filter((d) => d.id !== id));
  }

  if (loading) return <div className="py-8 text-center text-sm text-neutral-400">Cargando…</div>;
  if (error) return <div className="py-4 text-sm text-[#a32d2d]">Error: {error}</div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-neutral-500">{docs.length} documentos</span>
        <button
          onClick={() => setAdding((v) => !v)}
          className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-hover"
        >
          {adding ? "Cancelar" : "+ Agregar documento"}
        </button>
      </div>

      {adding && (
        <DocEditor
          initial={emptyDraft}
          onCancel={() => setAdding(false)}
          onSave={addDoc}
          saveLabel="Crear documento"
        />
      )}

      {docs.length === 0 && !adding ? (
        <div className="py-6 text-sm text-neutral-500">Sin documentos para esta propiedad.</div>
      ) : (
        <ul className="space-y-2">
          {docs.map((d) => (
            <li key={d.id} className="rounded-lg border border-line">
              {editingId === d.id ? (
                <div className="p-3">
                  <DocEditor
                    initial={toDraft(d)}
                    onCancel={() => setEditingId(null)}
                    onSave={(dr) => saveEdit(d.id, dr)}
                    onDelete={() => remove(d.id)}
                    saveLabel="Guardar"
                  />
                </div>
              ) : (
                <button
                  onClick={() => setEditingId(d.id)}
                  className="flex w-full items-start justify-between gap-3 p-3 text-left hover:bg-page/50"
                >
                  <div className="min-w-0">
                    <div className="font-medium">{d.title}</div>
                    {d.description && (
                      <div className="mt-0.5 line-clamp-2 text-xs text-neutral-500">{d.description}</div>
                    )}
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-neutral-400">
                      {d.assignee && (
                        <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-neutral-600">{d.assignee}</span>
                      )}
                      {d.due_date && <span>Vence: {d.due_date}</span>}
                    </div>
                  </div>
                  <DocumentStatusBadge status={d.status} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DocEditor({
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
    if (!dr.title.trim()) { setErr("El título es obligatorio."); return; }
    setBusy(true);
    setErr(null);
    const e = await onSave(dr);
    setBusy(false);
    if (e) setErr(e);
  }

  return (
    <div className="space-y-2 rounded-lg border border-line bg-page/40 p-3">
      <input
        value={dr.title}
        onChange={(e) => set("title", e.target.value)}
        placeholder="Título del documento"
        className="w-full rounded-md border border-line px-3 py-1.5 text-sm font-medium outline-none focus:border-brand"
      />
      <textarea
        value={dr.description}
        onChange={(e) => set("description", e.target.value)}
        placeholder="Descripción — qué se necesita y por qué"
        rows={2}
        className="w-full resize-y rounded-md border border-line px-3 py-1.5 text-sm outline-none focus:border-brand"
      />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <label className="text-xs text-neutral-500">
          Estado
          <select
            value={dr.status}
            onChange={(e) => set("status", e.target.value)}
            className="mt-1 w-full rounded-md border border-line bg-card px-2 py-1.5 text-sm outline-none focus:border-brand"
          >
            {DOCUMENT_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="text-xs text-neutral-500">
          Responsable
          <input
            value={dr.assignee}
            onChange={(e) => set("assignee", e.target.value)}
            placeholder="Bruno, Dueño…"
            className="mt-1 w-full rounded-md border border-line px-2 py-1.5 text-sm outline-none focus:border-brand"
          />
        </label>
        <label className="text-xs text-neutral-500">
          Vencimiento
          <input
            type="date"
            value={dr.due_date}
            onChange={(e) => set("due_date", e.target.value)}
            className="mt-1 w-full rounded-md border border-line px-2 py-1.5 text-sm outline-none focus:border-brand"
          />
        </label>
      </div>
      <textarea
        value={dr.notes}
        onChange={(e) => set("notes", e.target.value)}
        placeholder="Notas internas…"
        rows={2}
        className="w-full resize-y rounded-md border border-line px-3 py-1.5 text-sm outline-none focus:border-brand"
      />
      {err && <div className="text-xs text-[#a32d2d]">{err}</div>}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button
            onClick={submit}
            disabled={busy}
            className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-60"
          >
            {busy ? "Guardando…" : saveLabel}
          </button>
          <button
            onClick={onCancel}
            className="rounded-md border border-line px-3 py-1.5 text-sm text-neutral-600 hover:bg-page"
          >
            Cancelar
          </button>
        </div>
        {onDelete && (
          <button
            onClick={onDelete}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-[#a32d2d] hover:bg-[#fcebeb]"
          >
            Eliminar
          </button>
        )}
      </div>
    </div>
  );
}
