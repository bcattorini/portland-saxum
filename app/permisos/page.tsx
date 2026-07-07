// Permisos — server component. Loads properties + aggregates per-property
// comment stats from disciplines, then hands off to the client app.
import { createClient } from "@/lib/supabase/server";
import type { Discipline, Property, PropertyWithStats } from "@/lib/types";
import { PermisosApp } from "./PermisosApp";

export const dynamic = "force-dynamic";

export default async function PermisosPage({
  searchParams,
}: {
  searchParams: Promise<{ prop?: string }>;
}) {
  const { prop } = await searchParams;
  const supabase = await createClient();

  const [{ data: properties, error: pErr }, { data: disciplines, error: dErr }] =
    await Promise.all([
      supabase
        .from("properties")
        .select("*")
        .order("portfolio")
        .order("sort_order", { nullsFirst: false }),
      supabase
        .from("disciplines")
        .select("property_id, open_comments, total_comments, info_comments"),
    ]);

  if (pErr || dErr) {
    return (
      <div className="rounded-xl border border-line bg-card p-6 text-sm text-[#a32d2d]">
        Error al cargar propiedades: {pErr?.message || dErr?.message}
      </div>
    );
  }

  const byProp = new Map<string, { disc: number; open: number; total: number; info: number }>();
  for (const d of (disciplines ?? []) as Pick<
    Discipline,
    "property_id" | "open_comments" | "total_comments" | "info_comments"
  >[]) {
    const cur = byProp.get(d.property_id) ?? { disc: 0, open: 0, total: 0, info: 0 };
    cur.disc += 1;
    cur.open += d.open_comments ?? 0;
    cur.total += d.total_comments ?? 0;
    cur.info += d.info_comments ?? 0;
    byProp.set(d.property_id, cur);
  }

  const enriched: PropertyWithStats[] = ((properties ?? []) as Property[]).map((p) => {
    const s = byProp.get(p.id) ?? { disc: 0, open: 0, total: 0, info: 0 };
    return {
      ...p,
      disc_count: s.disc,
      open_sum: s.open,
      total_sum: s.total,
      info_sum: s.info,
    };
  });

  const initial = prop ? enriched.find((p) => p.id === prop) : undefined;

  return (
    <PermisosApp
      properties={enriched}
      initialSelectedId={initial?.id ?? null}
      initialPortfolio={initial?.portfolio}
    />
  );
}
