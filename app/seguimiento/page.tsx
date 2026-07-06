// Seguimiento (Follow Up) — brief §2/§3. Meeting list + detail, action items,
// manual entry + AI note extraction. Starts empty (build order §12.6).

export default function SeguimientoPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Seguimiento</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Reuniones con Pablo, Luis y otros. Notas + action items derivados.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="rounded-xl border border-line bg-card p-4 text-sm text-neutral-500">
          Lista de reuniones (más recientes primero). Vacío por ahora.
        </div>
        <div className="rounded-xl border border-dashed border-line bg-card/50 p-6 text-sm text-neutral-500">
          Detalle de la reunión seleccionada. Botones{" "}
          <span className="font-medium text-neutral-700">Nueva reunión</span> y{" "}
          <span className="font-medium text-neutral-700">Subir notas</span>{" "}
          (extracción con IA) se añaden en este módulo.
        </div>
      </div>
    </div>
  );
}
