"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { createClient } from "@/lib/supabase/client";
import type { QuickbooksCode } from "@/lib/types";

// Frequent permit codes — boosted to the top of suggestions (brief request).
const FREQUENT = ["SC 2.1", "SC 2.2", "SC 2.3", "SC 2.4", "SC 11.4", "SC 11.5", "HC 2.2", "SC 6.3", "SC 8.7"];

// Spanish (and abbrev) -> English keywords present in the QB names.
const SYN: Record<string, string[]> = {
  arquitecto: ["architectural"], arquitectura: ["architectural"], arquitectonico: ["architectural"],
  estructural: ["structural"], estructura: ["structural"], ingeniero: ["engineering", "structural"],
  mep: ["mep"], mecanico: ["mechanical"], electrico: ["electrical"], electricidad: ["electrical"],
  plomeria: ["plumbing"], plomero: ["plumbing"], civil: ["civil"],
  permiso: ["permit"], permisos: ["permit"], tasa: ["permit", "fee"], tasas: ["permit", "fee"], fee: ["fee"], fees: ["fee"],
  wasa: ["wasa"], agua: ["wasa", "water"],
  arbol: ["tree"], arboles: ["tree"], tala: ["tree"], poda: ["tree"],
  bond: ["bond"], fianza: ["bond"], fianzas: ["bond"],
  expeditor: ["expeditor"], expedidor: ["expeditor"], tramitador: ["expeditor"],
  seguro: ["insurance"], seguros: ["insurance"],
  demolicion: ["demolition"], demoler: ["demolition"], demo: ["demolition"],
  concreto: ["concrete"], hormigon: ["concrete"], masoneria: ["masonry"], mamposteria: ["masonry"],
  techo: ["roof"], techos: ["roof"], ventana: ["windows"], ventanas: ["windows"], puerta: ["doors"], puertas: ["doors"],
  pintura: ["paint"], paisajismo: ["landscape"], jardin: ["landscape"],
  impuesto: ["tax"], impuestos: ["tax"], abogado: ["legal"], legal: ["legal"],
  topografia: ["survey"], survey: ["survey"], suelo: ["geotechnical", "soil"], geotecnico: ["geotechnical"],
  contingencia: ["contingency"], honorarios: ["fee"],
};

function expand(q: string): string[] {
  const words = q.toLowerCase().split(/[^a-záéíóúñ0-9.]+/i).filter((w) => w.length >= 3);
  const out = new Set<string>();
  for (const w of words) {
    out.add(w);
    (SYN[w] || []).forEach((s) => out.add(s));
  }
  return [...out];
}

function rank(data: QuickbooksCode[], q: string): QuickbooksCode[] {
  const ql = q.toLowerCase();
  return data
    .map((c) => {
      let score = 0;
      if (FREQUENT.includes(c.code ?? "")) score += 100;
      const name = (c.name ?? "").toLowerCase();
      if (name.startsWith(ql)) score += 50;
      else if (name.includes(ql)) score += 20;
      return { c, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map((x) => x.c);
}

export function QbCodeInput({
  code,
  description,
  onChange,
  placeholder = "Buscá o escribí el código…",
}: {
  code: string;
  codeId?: string | null;
  description?: string;
  onChange: (code: string, codeId: string | null) => void;
  placeholder?: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [text, setText] = useState(code);
  const [hintName, setHintName] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<QuickbooksCode[]>([]);
  const [hi, setHi] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => setText(code), [code]);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  async function runSearch(q: string) {
    const words = expand(q || "");
    if (!words.length) { setResults([]); return; }
    const or = words
      .slice(0, 4)
      .flatMap((w) => [`name.ilike.*${w}*`, `division.ilike.*${w}*`, `code.ilike.*${w}*`])
      .join(",");
    const { data } = await supabase.from("quickbooks_codes").select("*").or(or).limit(30);
    setResults(rank((data ?? []) as QuickbooksCode[], q));
    setHi(0);
  }

  function pick(c: QuickbooksCode) {
    setText(c.code ?? "");
    setHintName(c.name);
    onChange(c.code ?? "", c.id);
    setOpen(false);
  }

  return (
    <div ref={boxRef} className="relative">
      <input
        value={text}
        placeholder={placeholder}
        onFocus={() => { setOpen(true); runSearch(text || description || ""); }}
        onChange={(e) => {
          const v = e.target.value;
          setText(v);
          setHintName(null);
          onChange(v, null);
          setOpen(true);
          runSearch(v || description || "");
        }}
        onKeyDown={(e) => {
          if (!open) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setHi((h) => Math.min(h + 1, results.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
          else if (e.key === "Enter" && results[hi]) { e.preventDefault(); pick(results[hi]); }
          else if (e.key === "Escape") setOpen(false);
        }}
        className="w-full rounded-md border border-line px-2 py-1.5 text-sm font-mono outline-none focus:border-brand"
      />
      {hintName && !open && (
        <div className="mt-0.5 truncate text-[11px] text-neutral-400">{hintName}</div>
      )}
      {open && results.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-64 w-full min-w-72 overflow-y-auto rounded-md border border-line bg-card shadow-lg">
          {results.map((c, i) => (
            <li key={c.id}>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); pick(c); }}
                onMouseEnter={() => setHi(i)}
                className={clsx("flex w-full flex-col items-start gap-0.5 px-3 py-1.5 text-left", i === hi ? "bg-page" : "hover:bg-page/60")}
              >
                <span className="text-sm">
                  <span className="font-mono font-semibold text-brand">{c.code}</span>{" "}
                  <span className="font-medium">{c.name}</span>
                </span>
                <span className="text-[11px] text-neutral-400">{c.category} · {c.division}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
