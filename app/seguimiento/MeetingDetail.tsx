"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { createClient } from "@/lib/supabase/client";
import type { ActionItem, Meeting } from "@/lib/types";

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

  async function toggleDone(it: ActionItem) {
    const { data } = await supabase
      .from("action_items")
      .update({ done: !it.done })
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
              <div className="mt-0.5 text-lg font-semibold tracking-tight">{meeting.title}</div>
              {meeting.participants && <div className="mt-0.5 text-sm text-neutral-500">{meeting.participants}</div>}
            </div>
            <div className="flex gap-2 text-sm">
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

        {/* Action items */}
        <div>
          <div className="mb-2 flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-neutral-400">
            Action items
            {openCount > 0 && <span className="badge badge-danger">{openCount} abiertos</span>}
          </div>

          <ul className="space-y-1.5">
            {items.map((it) =>
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
                <li key={it.id} className="flex items-start gap-2.5 rounded-md border border-line px-3 py-2">
                  <input type="checkbox" checked={it.done} onChange={() => toggleDone(it)}
                    className="mt-0.5 h-4 w-4 accent-[#1b3a6b]" />
                  <button onClick={() => setEditingItemId(it.id)} className="flex-1 text-left">
                    <span className={clsx("text-sm", it.done && "text-neutral-400 line-through")}>{it.text}</span>
                    <span className="mt-1 flex flex-wrap items-center gap-2">
                      {it.assignee && <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-600">{it.assignee}</span>}
                      {it.due_date && (
                        <span className={clsx("badge", !it.done && it.due_date < today ? "badge-danger" : "badge-neutral")}>
                          Vence {it.due_date}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              ),
            )}
            {items.length === 0 && <li className="text-sm text-neutral-400">Sin action items.</li>}
          </ul>

          {/* Add item */}
          <div className="mt-3 grid grid-cols-[1fr_130px_140px_auto] gap-2">
            <input value={newItem.text} onChange={(e) => setNewItem((p) => ({ ...p, text: e.target.value }))}
              onKeyDown={(e) => e.key === "Enter" && addItem()} placeholder="Nuevo action item…"
              className="rounded-md border border-line px-3 py-1.5 text-sm outline-none focus:border-brand" />
            <input value={newItem.assignee} onChange={(e) => setNewItem((p) => ({ ...p, assignee: e.target.value }))} placeholder="Responsable"
              className="rounded-md border border-line px-2 py-1.5 text-sm outline-none focus:border-brand" />
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
    <div className="grid grid-cols-[1fr_130px_140px_auto_auto] gap-2 rounded-md border border-brand/40 bg-page/40 p-2">
      <input value={text} onChange={(e) => setText(e.target.value)} className="rounded-md border border-line px-2 py-1.5 text-sm outline-none focus:border-brand" />
      <input value={assignee} onChange={(e) => setAssignee(e.target.value)} placeholder="Responsable" className="rounded-md border border-line px-2 py-1.5 text-sm outline-none focus:border-brand" />
      <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="rounded-md border border-line px-2 py-1.5 text-sm outline-none focus:border-brand" />
      <button onClick={() => onSave({ text: text.trim(), assignee: assignee.trim() || null, due_date: due || null })}
        className="rounded-md bg-brand px-3 text-sm font-medium text-white hover:bg-brand-hover">OK</button>
      <button onClick={onDelete} className="rounded-md px-2 text-sm text-[#a32d2d] hover:bg-[#fcebeb]" title="Eliminar">✕</button>
      <button onClick={onCancel} className="col-span-full text-left text-xs text-neutral-400 hover:underline">cancelar</button>
    </div>
  );
}
