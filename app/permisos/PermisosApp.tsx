"use client";

import { useState } from "react";
import clsx from "clsx";
import type { Portfolio, PropertyWithStats } from "@/lib/types";
import { CycleBadge } from "@/lib/badges";
import { PropertyPanel } from "./PropertyPanel";

const PORTFOLIOS: { key: Portfolio; label: string }[] = [
  { key: "portland_saxum", label: "Portland Saxum" },
  { key: "casas", label: "Casas" },
];

export function PermisosApp({
  properties,
  initialSelectedId = null,
  initialPortfolio = "portland_saxum",
}: {
  properties: PropertyWithStats[];
  initialSelectedId?: string | null;
  initialPortfolio?: Portfolio;
}) {
  const [portfolio, setPortfolio] = useState<Portfolio>(initialPortfolio);
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId);

  const visible = properties.filter((p) => p.portfolio === portfolio);
  const selected = properties.find((p) => p.id === selectedId) ?? null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Permisos</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Proceso de permisos por propiedad: Planos &amp; Ciudad, Documentos y Pagos.
        </p>
      </div>

      {/* Portfolio switcher */}
      <div className="inline-flex rounded-lg border border-line bg-card p-1 text-sm">
        {PORTFOLIOS.map((pf) => (
          <button
            key={pf.key}
            onClick={() => {
              setPortfolio(pf.key);
              setSelectedId(null);
            }}
            className={clsx(
              "rounded-md px-4 py-1.5 font-medium transition-colors",
              portfolio === pf.key
                ? "bg-brand text-white"
                : "text-neutral-500 hover:text-neutral-800",
            )}
          >
            {pf.label}
          </button>
        ))}
      </div>

      {/* Property cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((p) => (
          <PropertyCard
            key={p.id}
            property={p}
            active={p.id === selectedId}
            onClick={() => setSelectedId(p.id === selectedId ? null : p.id)}
          />
        ))}
      </div>

      {/* Property panel */}
      {selected && <PropertyPanel property={selected} />}
    </div>
  );
}

function PropertyCard({
  property: p,
  active,
  onClick,
}: {
  property: PropertyWithStats;
  active: boolean;
  onClick: () => void;
}) {
  const pct =
    p.total_sum > 0 ? Math.round(((p.total_sum - p.open_sum) / p.total_sum) * 100) : 0;

  return (
    <button
      onClick={onClick}
      className={clsx(
        "flex flex-col rounded-xl border bg-card p-4 text-left transition-all",
        active
          ? "border-brand ring-1 ring-brand"
          : "border-line hover:border-neutral-300 hover:shadow-sm",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-semibold tracking-tight">{p.address}</div>
          <div className="mt-0.5 font-mono text-xs text-neutral-400">
            {p.permit_number ?? "Sin permiso"}
          </div>
        </div>
        <CycleBadge cycle={p.cycle} />
      </div>

      {p.disc_count > 0 ? (
        <>
          <div className="mt-4 flex items-baseline gap-1.5">
            <span className="text-2xl font-semibold text-[#a32d2d]">{p.open_sum}</span>
            <span className="text-xs text-neutral-500">comentarios abiertos</span>
          </div>
          <div className="mt-3">
            <div className="mb-1 flex justify-between text-[11px] text-neutral-400">
              <span>{p.disc_count} disciplinas</span>
              <span>{pct}% resuelto</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
              <div
                className="h-full rounded-full bg-[#3b6d11]"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </>
      ) : (
        <div className="mt-4 text-xs text-neutral-400">
          {p.status_note ?? "Sin permiso en iBuild todavía"}
        </div>
      )}
    </button>
  );
}
