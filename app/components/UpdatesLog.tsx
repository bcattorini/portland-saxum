"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Update } from "@/lib/types";

const fmtDT = (iso: string) =>
  new Date(iso).toLocaleString("es", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

export function UpdatesLog({
  entityType,
  entityId,
  label = "Actualizaciones",
}: {
  entityType: "meeting" | "action_item";
  entityId: string;
  label?: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [list, setList] = useState<Update[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("updates")
        .select("*")
        .eq("entity_type", entityType)
        .eq("entity_id", entityId)
        .order("created_at", { ascending: false });
      if (!cancelled) setList((data ?? []) as Update[]);
    })();
    return () => { cancelled = true; };
  }, [entityType, entityId, supabase]);

  async function add() {
    if (!text.trim()) return;
    setBusy(true);
    const { data } = await supabase
      .from("updates")
      .insert({ entity_type: entityType, entity_id: entityId, body: text.trim() })
      .select()
      .single();
    if (data) { setList((prev) => [data as Update, ...prev]); setText(""); }
    setBusy(false);
  }

  return (
    <div>
      <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-neutral-400">
        {label} ({list.length})
      </div>
      <div className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Agregar update (se guarda con fecha)…"
          className="flex-1 rounded-md border border-line px-3 py-1.5 text-sm outline-none focus:border-brand"
        />
        <button
          onClick={add}
          disabled={busy || !text.trim()}
          className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50"
        >
          Agregar
        </button>
      </div>
      {list.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {list.map((u) => (
            <li key={u.id} className="rounded-md border border-line px-3 py-1.5">
              <div className="text-[11px] text-neutral-400">{fmtDT(u.created_at)}</div>
              <div className="whitespace-pre-wrap text-sm text-neutral-700">{u.body}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
