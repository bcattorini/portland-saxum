"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Summary = {
  filename: string;
  permit: string | null;
  matched: boolean;
  propertyAddress?: string;
  toUpdate: number;
  toInsert: number;
  staleKept: number;
  resolvedThisImport: number;
  newComments: number;
  trackedPreserved: number[];
  disciplinesToCreate: string[];
  applied: boolean;
  cycleNo?: number;
  unresolvedAfter?: number;
  error?: string;
};

export function IbuildUpload() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [preview, setPreview] = useState<Summary[] | null>(null);
  const [applied, setApplied] = useState<Summary[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setFiles([]); setPreview(null); setApplied(null); setError(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function send(chosen: File[], apply: boolean): Promise<Summary[] | null> {
    const fd = new FormData();
    for (const f of chosen) fd.append("files", f);
    fd.append("apply", apply ? "1" : "0");
    const res = await fetch("/api/ibuild-import", { method: "POST", body: fd });
    const json = await res.json();
    if (!res.ok) { setError(json.error || "Error en la importación."); return null; }
    return json.results as Summary[];
  }

  async function onPick(list: FileList | null) {
    const chosen = Array.from(list ?? []).filter((f) => /\.pdf$/i.test(f.name));
    if (!chosen.length) return;
    setFiles(chosen); setError(null); setApplied(null); setBusy(true);
    const results = await send(chosen, false);
    setBusy(false);
    if (results) setPreview(results);
  }

  async function confirm() {
    setBusy(true); setError(null);
    const results = await send(files, true);
    setBusy(false);
    if (results) { setApplied(results); setPreview(null); }
  }

  const anyMatched = preview?.some((s) => s.matched);

  return (
    <div className="rounded-xl border border-line bg-card">
      <button
        onClick={() => { setOpen((v) => !v); if (open) reset(); }}
        className="flex w-full items-center justify-between px-5 py-3 text-left"
      >
        <span className="text-sm font-semibold">📄 Subir reporte de iBuild (PDF)</span>
        <span className="text-xs text-neutral-400">{open ? "Cerrar" : "Abrir"}</span>
      </button>

      {open && (
        <div className="space-y-3 border-t border-line px-5 py-4">
          {!preview && !applied && (
            <div>
              <p className="mb-2 text-xs text-neutral-500">
                Subí el &quot;Plan Review - Review Comments Report&quot; de una o varias propiedades. Primero te muestro un resumen; nada se guarda hasta que confirmes. Los responsables y follow-ups se mantienen.
              </p>
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf"
                multiple
                onChange={(e) => onPick(e.target.files)}
                className="block w-full text-sm text-neutral-600 file:mr-3 file:rounded-md file:border-0 file:bg-brand file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-brand-hover"
              />
            </div>
          )}

          {busy && <div className="py-3 text-sm text-neutral-400">Procesando…</div>}
          {error && <div className="rounded-md bg-[#fdecec] px-3 py-2 text-sm text-[#a32d2d]">Error: {error}</div>}

          {preview && !busy && (
            <div className="space-y-3">
              <div className="text-xs font-medium uppercase tracking-wide text-neutral-400">Previsualización (todavía no se guardó)</div>
              {preview.map((s, i) => (
                <SummaryCard key={i} s={s} mode="preview" />
              ))}
              <div className="flex gap-2">
                <button onClick={confirm} disabled={busy || !anyMatched}
                  className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50">
                  Confirmar y actualizar
                </button>
                <button onClick={reset} className="rounded-md border border-line px-4 py-2 text-sm text-neutral-600 hover:bg-page">Cancelar</button>
              </div>
            </div>
          )}

          {applied && !busy && (
            <div className="space-y-3">
              <div className="rounded-md bg-[#eaf3de] px-3 py-2 text-sm font-medium text-[#3b6d11]">✓ Importación aplicada.</div>
              {applied.map((s, i) => (
                <SummaryCard key={i} s={s} mode="applied" />
              ))}
              <div className="flex gap-2">
                <button onClick={() => { reset(); router.refresh(); }} className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover">
                  Actualizar vista
                </button>
                <button onClick={reset} className="rounded-md border border-line px-4 py-2 text-sm text-neutral-600 hover:bg-page">Subir otro</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SummaryCard({ s, mode }: { s: Summary; mode: "preview" | "applied" }) {
  if (s.error) return (
    <div className="rounded-lg border border-[#f0c9c9] bg-[#fdf5f5] px-3 py-2 text-sm">
      <span className="font-medium">{s.filename}</span> — <span className="text-[#a32d2d]">Error: {s.error}</span>
    </div>
  );
  if (!s.matched) return (
    <div className="rounded-lg border border-line bg-page/40 px-3 py-2 text-sm">
      <span className="font-medium">{s.filename}</span> — <span className="text-[#a32d2d]">no coincide con ninguna propiedad</span> (permiso {s.permit ?? "?"}). No se toca nada.
    </div>
  );
  return (
    <div className="rounded-lg border border-line bg-page/40 px-3 py-2.5 text-sm">
      <div className="font-medium">{s.propertyAddress} <span className="font-normal text-neutral-400">· {s.filename}</span></div>
      <ul className="mt-1 space-y-0.5 text-xs text-neutral-600">
        <li>{s.toUpdate} comentarios a actualizar · {s.toInsert} nuevos {s.staleKept > 0 && <span className="text-neutral-400">· {s.staleKept} viejos se conservan</span>}</li>
        <li className="text-[#3b6d11] font-medium">
          {mode === "applied" ? `✓ ${s.resolvedThisImport} resueltos este import` : `${s.resolvedThisImport} se marcarían como resueltos`}
          {mode === "applied" && s.unresolvedAfter != null && <span className="font-normal text-neutral-500"> · quedan {s.unresolvedAfter} pendientes</span>}
        </li>
        {s.disciplinesToCreate.length > 0 && <li className="text-neutral-500">disciplinas nuevas: {s.disciplinesToCreate.join(", ")}</li>}
        <li className="text-neutral-500">seguimientos preservados: {s.trackedPreserved.length ? s.trackedPreserved.map((r) => `#${r}`).join(", ") : "—"}</li>
        {mode === "applied" && s.cycleNo != null && <li className="text-neutral-400">registro de ciclo #{s.cycleNo} guardado</li>}
      </ul>
    </div>
  );
}
