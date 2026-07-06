// Resumen (Overview) — brief §1/§2. Read-only summary computed from the other
// modules. Built last (build order §12.7) once real data exists to summarize.

const KPIS = [
  { label: "Comentarios iBuild abiertos", hint: "de todas las disciplinas" },
  { label: "Documentos pendientes", hint: "por entregar" },
  { label: "Pagos pendientes", hint: "próximos 14 días" },
  { label: "Action items abiertos", hint: "de reuniones" },
];

export default function OverviewPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Resumen</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Lo más urgente en todos los módulos. Cada elemento enlaza a su módulo
          de origen.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {KPIS.map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-xl border border-line bg-card p-4"
          >
            <div className="text-3xl font-semibold text-neutral-300">—</div>
            <div className="mt-2 text-sm font-medium">{kpi.label}</div>
            <div className="text-xs text-neutral-400">{kpi.hint}</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-dashed border-line bg-card/50 p-6 text-sm text-neutral-500">
        El Resumen se calcula a partir de los módulos de Permisos y Seguimiento.
        Se activa cuando haya datos reales conectados (Supabase + importación
        iBuild).
      </div>
    </div>
  );
}
