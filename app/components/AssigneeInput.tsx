"use client";

import { useState } from "react";
import { PEOPLE } from "@/lib/users";

const NAMES = PEOPLE.map((p) => p.name);

// Responsable picker: quick-select Bruno/Sol (stored as their name) or "Otro…" free text.
export function AssigneeInput({
  value,
  onChange,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  const isKnown = NAMES.includes(value);
  const [otro, setOtro] = useState(!!value && !isKnown);
  const selectVal = otro ? "__otro__" : value === "" ? "" : isKnown ? value : "__otro__";

  return (
    <div className={className}>
      <select
        value={selectVal}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "__otro__") { setOtro(true); onChange(""); }
          else { setOtro(false); onChange(v); }
        }}
        className="w-full rounded-md border border-line bg-card px-2 py-1.5 text-sm outline-none focus:border-brand"
      >
        <option value="">— Responsable</option>
        {NAMES.map((n) => (<option key={n} value={n}>{n}</option>))}
        <option value="__otro__">Otro…</option>
      </select>
      {otro && (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Nombre…"
          className="mt-1 w-full rounded-md border border-line px-2 py-1.5 text-sm outline-none focus:border-brand"
        />
      )}
    </div>
  );
}
