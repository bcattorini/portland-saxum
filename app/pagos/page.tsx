// Pagos General — company-level payments (Hard/Soft Costs), not tied to a permit.
import { PaymentsManager } from "@/app/components/PaymentsManager";

export const dynamic = "force-dynamic";

export default function PagosPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Pagos</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Pagos a nivel empresa (Hard Costs / Soft Costs), no atados a una propiedad de permisos.
        </p>
      </div>
      <PaymentsManager scope="general" />
    </div>
  );
}
