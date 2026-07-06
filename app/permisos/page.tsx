// Permisos — brief §2/§3. Portfolio tabs → property cards → property panel
// with three tabs (Planos & Ciudad / Documentos / Pagos).
// Placeholder shell until the prototype comment data + Supabase are connected.

export default function PermisosPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Permisos</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Proceso de permisos por propiedad: Planos &amp; Ciudad, Documentos y
          Pagos.
        </p>
      </div>

      {/* Portfolio switcher (visual only for now) */}
      <div className="inline-flex rounded-lg border border-line bg-card p-1 text-sm">
        <span className="rounded-md bg-brand px-3 py-1.5 font-medium text-white">
          Portland Saxum
        </span>
        <span className="px-3 py-1.5 font-medium text-neutral-500">Casas</span>
      </div>

      <div className="rounded-xl border border-dashed border-line bg-card/50 p-6 text-sm text-neutral-500">
        Las tarjetas de propiedades y el panel de disciplinas se cargan desde
        los datos reales de iBuild. Pendiente: importar{" "}
        <code className="rounded bg-neutral-100 px-1">
          PermitTracker_PortlandSaxum_v4.html
        </code>{" "}
        y{" "}
        <code className="rounded bg-neutral-100 px-1">
          PermitTracker_Casas_v3.html
        </code>
        .
      </div>
    </div>
  );
}
