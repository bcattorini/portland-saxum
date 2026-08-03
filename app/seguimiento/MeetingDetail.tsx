"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { createClient } from "@/lib/supabase/client";
import type { ActionItem, Meeting } from "@/lib/types";
import { UpdatesLog } from "@/app/components/UpdatesLog";
import { AssigneeInput } from "@/app/components/AssigneeInput";

const fmtD = (iso: string) => new Date(iso).toLocaleDateString("es");

export function MeetingDetail({
  meeting,
  items,
  onMeetingUpdated,
  onMeetingDeleted,
  onItemsChanged,
}: {
  meeting: Meeting;
  items: ActionItem[];
  onMeetingUpdated: (m: Meeting) => void;
  onMeetingDeleted: (id: string) => void;
  onItemsChanged: (next: ActionItem[]) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [editing, setEditing] = useState(false);
  const [mTitle, setMTitle] = useState(meeting.title);
  const [mParticipants, setMParticipants] = useState(meeting.participants ?? "");
  const [mDate, setMDate] = useState(meeting.meeting_date);
  const [mNotes, setMNotes] = useState(meeting.notes ?? "");
  const [newItem, setNewItem] = useState({ text: "", assignee: "", due_date: "" });
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  async function saveMeeting() {
    const { data, error } = await supabase
      .from("meetings")
      .update({
        title: mTitle.trim(),
        participants: mParticipants.trim() || null,
        meeting_date: mDate,
        notes: mNotes.trim() || null,
      })
      .eq("id", meeting.id)
      .select()
      .single();
    if (!error && data) { onMeetingUpdated(data as Meeting); setEditing(false); }
  }

  async function deleteMeeting() {
    const { error } = await supabase.from("meetings").delete().eq("id", meeting.id);
    if (!error) onMeetingDeleted(meeting.id);
  }

  async function setMeetingFinalized(val: boolean) {
    const { data, error } = await supabase
      .from("meetings")
      .update({ finalized_at: val ? new Date().toISOString() : null })
      .eq("id", meeting.id)
      .select()
      .single();
    if (!error && data) onMeetingUpdated(data as Meeting);
  }

  async function toggleDone(it: ActionItem) {
    const { data } = await supabase
      .from("action_items")
      .update({ done: !it.done })
      .eq("id", it.id)
      .select()
      .single();
    if (data) onItemsChanged(items.map((x) => (x.id === it.id ? (data as ActionItem) : x)));
  }

  async function setFinalized(it: ActionItem, val: boolean) {
    const { data } = await supabase
      .from("action_items")
      .update({ finalized_at: val ? new Date().toISOString() : null, done: val })
      .eq("id", it.id)
      .select()
      .single();
    if (data) onItemsChanged(items.map((x) => (x.id === it.id ? (data as ActionItem) : x)));
  }

  async function toggleUrgent(it: ActionItem) {
    const { data } = await supabase
      .from("action_items")
      .update({ urgent: !it.urgent })
      .eq("id", it.id)
      .select()
      .single();
    if (data) onItemsChanged(items.map((x) => (x.id === it.id ? (data as ActionItem) : x)));
  }

  async function addItem() {
    if (!newItem.text.trim()) return;
    const { data } = await supabase
      .from("action_items")
      .insert({
        meeting_id: meeting.id,
        text: newItem.text.trim(),
        assignee: newItem.assignee.trim() || null,
        due_date: newItem.due_date || null,
      })
      .select()
      .single();
    if (data) {
      onItemsChanged([...items, data as ActionItem]);
      setNewItem({ text: "", assignee: "", due_date: "" });
    }
  }

  async function saveItem(id: string, patch: Partial<ActionItem>) {
    const { data } = await supabase.from("action_items").update(patch).eq("id", id).select().single();
    if (data) { onItemsChanged(items.map((x) => (x.id === id ? (data as ActionItem) : x))); setEditingItemId(null); }
  }

  async function deleteItem(id: string) {
    const { error } = await supabase.from("action_items").delete().eq("id", id);
    if (!error) onItemsChanged(items.filter((x) => x.id !== id));
  }

  const openCount = items.filter((i) => !i.done).length;
  const closed = (i: ActionItem) => i.done || !!i.finalized_at;
  const sortedItems = [...items].sort((a, b) => {
    if (closed(a) !== closed(b)) return closed(a) ? 1 : -1; // open first
    if (!!a.urgent !== !!b.urgent) return a.urgent ? -1 : 1; // urgent first
    const ad = a.due_date ?? "9999-99-99", bd = b.due_date ?? "9999-99-99";
    return ad < bd ? -1 : ad > bd ? 1 : 0;
  });

  return (
    <div className="rounded-xl border border-line bg-card">
      {/* Header */}
      <div className="border-b border-line px-5 py-4">
        {editing ? (
          <div className="space-y-2">
            <input value={mTitle} onChange={(e) => setMTitle(e.target.value)}
              className="w-full rounded-md border border-line px-3 py-1.5 text-sm font-medium outline-none focus:border-brand" />
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <input type="date" value={mDate} onChange={(e) => setMDate(e.target.value)}
                className="rounded-md border border-line px-3 py-1.5 text-sm outline-none focus:border-brand" />
              <input value={mParticipants} onChange={(e) => setMParticipants(e.target.value)} placeholder="Participantes"
                className="rounded-md border border-line px-3 py-1.5 text-sm outline-none focus:border-brand" />
            </div>
            <textarea value={mNotes} onChange={(e) => setMNotes(e.target.value)} rows={4}
              className="w-full resize-y rounded-md border border-line px-3 py-1.5 text-sm outline-none focus:border-brand" />
            <div className="flex gap-2">
              <button onClick={saveMeeting} className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-hover">Guardar</button>
              <button onClick={() => setEditing(false)} className="rounded-md border border-line px-3 py-1.5 text-sm text-neutral-600 hover:bg-page">Cancelar</button>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs text-neutral-400">{meeting.meeting_date}</div>
              <div className="mt-0.5 flex flex-wrap items-center gap-2">
                <span className="text-lg font-semibold tracking-tight">{meeting.title}</span>
                {meeting.finalized_at && <span className="badge badge-success">✓ Finalizado</span>}
              </div>
              {meeting.participants && <div className="mt-0.5 text-sm text-neutral-500">{meeting.participants}</div>}
              {meeting.finalized_at && (
                <div className="mt-1 text-xs text-[#3b6d11]">Finalizado el {fmtD(meeting.finalized_at)}</div>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2 text-sm">
              {meeting.finalized_at ? (
                <button onClick={() => setMeetingFinalized(false)} className="text-brand hover:underline">Reabrir</button>
              ) : (
                <button onClick={() => setMeetingFinalized(true)} className="rounded-md bg-[#eaf3de] px-2.5 py-1 text-xs font-medium text-[#3b6d11] hover:bg-[#dfeecb]">
                  ✓ Finalizar tema
                </button>
              )}
              <button onClick={() => setEditing(true)} className="text-neutral-500 hover:underline">Editar</button>
              <button onClick={deleteMeeting} className="font-medium text-[#a32d2d] hover:underline">Eliminar</button>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-6 px-5 py-5">
        {/* Notes */}
        {meeting.notes && !editing && (
          <div>
            <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-neutral-400">Notas</div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-700">{meeting.notes}</p>
          </div>
        )}

        {/* Actualizaciones de la reunión (fechadas) */}
        {!editing && <UpdatesLog entityType="meeting" entityId={meeting.id} />}

        {/* Action items */}
        <div>
          <div className="mb-2 flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-neutral-400">
            Action items
            {openCount > 0 && <span className="badge badge-danger">{openCount} abiertos</span>}
          </div>

          <ul className="space-y-1.5">
            {sortedItems.map((it) =>
              editingItemId === it.id ? (
                <li key={it.id}>
                  <ItemEditor
                    item={it}
                    onSave={(patch) => saveItem(it.id, patch)}
                    onCancel={() => setEditingItemId(null)}
                    onDelete={() => deleteItem(it.id)}
                  />
                </li>
              ) : (
                <li key={it.id} className={clsx(
                  "flex items-start gap-2.5 rounded-md border px-3 py-2",
                  it.finalized_at ? "border-[#cfe3b6] bg-[#f6faf0]"
                    : it.urgent && !it.done ? "border-[#f0c9c9] bg-[#fdf5f5]"
                    : "border-line",
                )}>
                  <input type="checkbox" checked={it.done} onChange={() => toggleDone(it)}
                    className="mt-0.5 h-4 w-4 accent-[#1b3a6b]" />
                  <button onClick={() => setEditingItemId(it.id)} className="min-w-0 flex-1 text-left">
                    <span className={clsx("text-sm", it.done && "text-neutral-400 line-through")}>{it.text}</span>
                    <span className="mt-1 flex flex-wrap items-center gap-2">
                      {it.urgent && !it.done && <span className="badge badge-danger">🔴 Urgente</span>}
                      {it.assignee && <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-600">{it.assignee}</span>}
                      {it.due_date && (
                        <span className={clsx("badge", !it.done && it.due_date < today ? "badge-danger" : "badge-neutral")}>
                          Vence {it.due_date}
                        </span>
                      )}
                    </span>
                  </button>
                  <div className="flex shrink-0 flex-col items-end gap-1 text-right">
                    {!it.done && (
                      <button onClick={() => toggleUrgent(it)} title="Marcar urgente"
                        className={clsx("text-[11px]", it.urgent ? "font-medium text-[#a32d2d]" : "text-neutral-400 hover:text-[#a32d2d]")}>
                        {it.urgent ? "Quitar urgente" : "Urgente"}
                      </button>
                    )}
                    {it.finalized_at ? (
                      <div>
                        <div className="text-[11px] font-medium text-[#3b6d11]">✓ Finalizado</div>
                        <div className="text-[10px] text-neutral-400">{fmtD(it.finalized_at)}</div>
                        <button onClick={() => setFinalized(it, false)} className="text-[11px] text-brand hover:underline">Reabrir</button>
                      </div>
                    ) : (
                      <button onClick={() => setFinalized(it, true)}
                        className="rounded-md bg-[#eaf3de] px-2 py-0.5 text-[11px] font-medium text-[#3b6d11] hover:bg-[#dfeecb]">
                        ✓ Finalizar
                      </button>
                    )}
                  </div>
                </li>
              ),
            )}
            {items.length === 0 && <li className="text-sm text-neutral-400">Sin action items.</li>}
          </ul>

          {/* Add item */}
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_130px_140px_auto]">
            <input value={newItem.text} onChange={(e) => setNewItem((p) => ({ ...p, text: e.target.value }))}
              onKeyDown={(e) => e.key === "Enter" && addItem()} placeholder="Nuevo action item…"
              className="rounded-md border border-line px-3 py-1.5 text-sm outline-none focus:border-brand" />
            <AssigneeInput value={newItem.assignee} onChange={(v) => setNewItem((p) => ({ ...p, assignee: v }))} />
            <input type="date" value={newItem.due_date} onChange={(e) => setNewItem((p) => ({ ...p, due_date: e.target.value }))}
              className="rounded-md border border-line px-2 py-1.5 text-sm outline-none focus:border-brand" />
            <button onClick={addItem} className="rounded-md bg-brand px-3 text-sm font-medium text-white hover:bg-brand-hover">Añadir</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ItemEditor({
  item,
  onSave,
  onCancel,
  onDelete,
}: {
  item: ActionItem;
  onSave: (patch: Partial<ActionItem>) => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const [text, setText] = useState(item.text);
  const [assignee, setAssignee] = useState(item.assignee ?? "");
  const [due, setDue] = useState(item.due_date ?? "");
  return (
    <div className="space-y-2 rounded-md border border-brand/40 bg-page/40 p-2">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_130px_140px_auto_auto]">
        <input value={text} onChange={(e) => setText(e.target.value)} className="rounded-md border border-line px-2 py-1.5 text-sm outline-none focus:border-brand" />
        <AssigneeInput value={assignee} onChange={setAssignee} />
        <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="rounded-md border border-line px-2 py-1.5 text-sm outline-none focus:border-brand" />
        <button onClick={() => onSave({ text: text.trim(), assignee: assignee.trim() || null, due_date: due || null })}
          className="rounded-md bg-brand px-3 text-sm font-medium text-white hover:bg-brand-hover">OK</button>
        <button onClick={onDelete} className="rounded-md px-2 text-sm text-[#a32d2d] hover:bg-[#fcebeb]" title="Eliminar">✕</button>
      </div>
      <button onClick={onCancel} className="text-xs text-neutral-400 hover:underline">cancelar</button>
      <div className="border-t border-line pt-2">
        <UpdatesLog entityType="action_item" entityId={item.id} label="Updates de esta tarea" />
      </div>
    </div>
  );
}
