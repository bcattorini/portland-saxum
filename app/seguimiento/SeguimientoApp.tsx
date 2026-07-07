"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { createClient } from "@/lib/supabase/client";
import type { ActionItem, Meeting } from "@/lib/types";
import { MeetingForm } from "./MeetingForm";
import { MeetingDetail } from "./MeetingDetail";

export function SeguimientoApp() {
  const supabase = useMemo(() => createClient(), []);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [items, setItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: mtgs, error: mErr } = await supabase
        .from("meetings")
        .select("*")
        .order("meeting_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (mErr) {
        if (!cancelled) { setError(mErr.message); setLoading(false); }
        return;
      }
      const list = (mtgs ?? []) as Meeting[];
      let ai: ActionItem[] = [];
      if (list.length) {
        const { data: aData } = await supabase
          .from("action_items")
          .select("*")
          .in("meeting_id", list.map((m) => m.id))
          .order("created_at");
        ai = (aData ?? []) as ActionItem[];
      }
      if (cancelled) return;
      setMeetings(list);
      setItems(ai);
      setSelectedId((cur) => cur ?? list[0]?.id ?? null);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [supabase]);

  const openCountByMeeting = useMemo(() => {
    const m = new Map<string, number>();
    for (const it of items) if (!it.done) m.set(it.meeting_id, (m.get(it.meeting_id) ?? 0) + 1);
    return m;
  }, [items]);

  const selected = meetings.find((m) => m.id === selectedId) ?? null;
  const selectedItems = items.filter((it) => it.meeting_id === selectedId);

  function onCreated(meeting: Meeting, newItems: ActionItem[]) {
    setMeetings((prev) => [meeting, ...prev]);
    setItems((prev) => [...prev, ...newItems]);
    setSelectedId(meeting.id);
    setCreating(false);
  }

  function onMeetingUpdated(m: Meeting) {
    setMeetings((prev) => prev.map((x) => (x.id === m.id ? m : x)));
  }
  function onMeetingDeleted(id: string) {
    setMeetings((prev) => prev.filter((x) => x.id !== id));
    setItems((prev) => prev.filter((x) => x.meeting_id !== id));
    setSelectedId((cur) => (cur === id ? null : cur));
  }
  function onItemsChanged(meetingId: string, next: ActionItem[]) {
    setItems((prev) => [...prev.filter((x) => x.meeting_id !== meetingId), ...next]);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Seguimiento</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Reuniones con Pablo, Luis y otros. Notas + action items derivados.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setCreating(true); setSelectedId(null); }}
            className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-hover"
          >
            + Nueva reunión
          </button>
          <button
            disabled
            title="Disponible cuando se configure la Anthropic API key"
            className="cursor-not-allowed rounded-md border border-line px-3 py-1.5 text-sm font-medium text-neutral-400"
          >
            Subir notas (IA)
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* Left: meeting list */}
        <div className="space-y-2">
          {loading ? (
            <div className="rounded-xl border border-line bg-card p-4 text-sm text-neutral-400">Cargando…</div>
          ) : error ? (
            <div className="rounded-xl border border-line bg-card p-4 text-sm text-[#a32d2d]">Error: {error}</div>
          ) : meetings.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line bg-card/50 p-4 text-sm text-neutral-500">
              Sin reuniones todavía. Creá la primera con “Nueva reunión”.
            </div>
          ) : (
            <ul className="space-y-2">
              {meetings.map((m) => {
                const open = openCountByMeeting.get(m.id) ?? 0;
                const active = m.id === selectedId && !creating;
                return (
                  <li key={m.id}>
                    <button
                      onClick={() => { setSelectedId(m.id); setCreating(false); }}
                      className={clsx(
                        "w-full rounded-xl border bg-card p-3 text-left transition-all",
                        active ? "border-brand ring-1 ring-brand" : "border-line hover:border-neutral-300",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-neutral-400">{m.meeting_date}</span>
                        {open > 0 && (
                          <span className="badge badge-danger">{open} abiertos</span>
                        )}
                      </div>
                      <div className="mt-1 font-medium">{m.title}</div>
                      {m.participants && (
                        <div className="mt-0.5 text-xs text-neutral-500">{m.participants}</div>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Right: detail or new-meeting form */}
        <div>
          {creating ? (
            <MeetingForm onCancel={() => setCreating(false)} onCreated={onCreated} />
          ) : selected ? (
            <MeetingDetail
              meeting={selected}
              items={selectedItems}
              onMeetingUpdated={onMeetingUpdated}
              onMeetingDeleted={onMeetingDeleted}
              onItemsChanged={(next) => onItemsChanged(selected.id, next)}
            />
          ) : (
            <div className="rounded-xl border border-dashed border-line bg-card/50 p-8 text-center text-sm text-neutral-500">
              Seleccioná una reunión de la lista, o creá una nueva.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
