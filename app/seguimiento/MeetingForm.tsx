"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ActionItem, Meeting } from "@/lib/types";

type ItemDraft = { text: string; assignee: string; due_date: string };
const blankItem = (): ItemDraft => ({ text: "", assignee: "", due_date: "" });

export function MeetingForm({
  onCancel,
  onCreated,
}: {
  onCancel: () => void;
  onCreated: (meeting: Meeting, items: ActionItem[]) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [date, setDate] = useState(today);
  const [title, setTitle] = useState("");
  const [participants, setParticipants] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<ItemDraft[]>([blankItem()]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const setItem = (i: number, k: keyof ItemDraft, v: string) =>
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, [k]: v } : it)));
  const addRow = () => setItems((prev) => [...prev, blankItem()]);
  const removeRow = (i: number) => setItems((prev) => prev.filter((_, idx) => idx !== i));

  async function submit() {
    if (!title.trim()) { setErr("El título es obligatorio."); return; }
    if (!date) { setErr("La fecha es obligatoria."); return; }
    setBusy(true);
    setErr(null);

    const { data: meeting, error: mErr } = await supabase
      .from("meetings")
      .insert({
        title: title.trim(),
        participants: participants.trim() || null,
        meeting_date: date,
        notes: notes.trim() || null,
      })
      .select()
      .single();

    if (mErr || !meeting) { setErr(mErr?.message ?? "Error al crear la reunión."); setBusy(false); return; }

    const rows = items
      .filter((it) => it.text.trim())
      .map((it) => ({
        meeting_id: (meeting as Meeting).id,
        text: it.text.trim(),
        assignee: it.assignee.trim() || null,
        due_date: it.due_date || null,
      }));

    let created: ActionItem[] = [];
    if (rows.length) {
      const { data: ai, error: aErr } = await supabase.from("action_items").insert(rows).select();
      if (aErr) { setErr(aErr.message); setBusy(false); return; }
      created = (ai ?? []) as ActionItem[];
    }

    setBusy(false);
    onCreated(meeting as Meeting, created);
  }

  return (
    <div className="rounded-xl border border-line bg-card p-5">
      <div className="mb-4 text-lg font-semibold tracking-tight">Nueva reunión</div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="text-xs text-neutral-500">
          Fecha
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="mt-1 w-full rounded-md border border-line px-3 py-1.5 text-sm outline-none focus:border-brand" />
        </label>
        <label className="text-xs text-neutral-500">
          Participantes
          <input value={participants} onChange={(e) => setParticipants(e.target.value)} placeholder="Bruno, Pablo, Luis"
            className="mt-1 w-full rounded-md border border-line px-3 py-1.5 text-sm outline-none focus:border-brand" />
        </label>
      </div>
      <label className="mt-3 block text-xs text-neutral-500">
        Título
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej: Weekly call con Pablo"
          className="mt-1 w-full rounded-md border border-line px-3 py-1.5 text-sm font-medium outline-none focus:border-brand" />
      </label>
      <label className="mt-3 block text-xs text-neutral-500">
        Notas
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} placeholder="Qué se discutió — en español…"
          className="mt-1 w-full resize-y rounded-md border border-line px-3 py-1.5 text-sm outline-none focus:border-brand" />
      </label>

      {/* Action items builder */}
      <div className="mt-4">
        <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-neutral-400">Action items</div>
        <div className="space-y-2">
          {items.map((it, i) => (
            <div key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_140px_150px_auto]">
              <input value={it.text} onChange={(e) => setItem(i, "text", e.target.value)} placeholder="Acción — ej: Pablo confirma fecha de drywall"
                className="rounded-md border border-line px-3 py-1.5 text-sm outline-none focus:border-brand" />
              <input value={it.assignee} onChange={(e) => setItem(i, "assignee", e.target.value)} placeholder="Responsable"
                className="rounded-md border border-line px-2 py-1.5 text-sm outline-none focus:border-brand" />
              <input type="date" value={it.due_date} onChange={(e) => setItem(i, "due_date", e.target.value)}
                className="rounded-md border border-line px-2 py-1.5 text-sm outline-none focus:border-brand" />
              <button onClick={() => removeRow(i)} disabled={items.length === 1}
                className="rounded-md px-2 text-neutral-400 hover:bg-page hover:text-[#a32d2d] disabled:opacity-30" aria-label="Quitar fila">
                ✕
              </button>
            </div>
          ))}
        </div>
        <button onClick={addRow} className="mt-2 text-sm font-medium text-brand hover:underline">
          + Agregar action item
        </button>
      </div>

      {err && <div className="mt-3 text-xs text-[#a32d2d]">{err}</div>}
      <div className="mt-4 flex gap-2">
        <button onClick={submit} disabled={busy}
          className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-60">
          {busy ? "Guardando…" : "Crear reunión"}
        </button>
        <button onClick={onCancel} className="rounded-md border border-line px-4 py-2 text-sm text-neutral-600 hover:bg-page">
          Cancelar
        </button>
      </div>
    </div>
  );
}
