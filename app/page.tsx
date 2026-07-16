// Resumen (Overview) — brief §3. Read-only summary computed from all modules.
// KPI row + "Necesita atención" (top urgent, cross-module) + last meeting preview.
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type {
  ActionItem,
  Discipline,
  Meeting,
  Payment,
  Property,
  PropertyDocument,
} from "@/lib/types";
import { PendingPaymentsCard, type PendingItem } from "./components/PendingPaymentsCard";

export const dynamic = "force-dynamic";

const DAY = 86400000;

export default async function OverviewPage() {
  const supabase = await createClient();
  const [
    { data: properties },
    { data: disciplines },
    { data: documents },
    { data: payments },
    { data: generalPayments },
    { data: meetings },
    { data: actionItems },
  ] = await Promise.all([
    supabase.from("properties").select("id, address, portfolio"),
    supabase.from("disciplines").select("property_id, open_comments"),
    supabase.from("property_documents").select("id, property_id, title, status, due_date, assignee"),
    supabase.from("payments").select("id, property_id, description, amount, currency, due_date, status, payment_type, quickbooks_code"),
    supabase.from("general_payments").select("id, description, amount, currency, due_date, status, payment_type, quickbooks_code"),
    supabase.from("meetings").select("*").order("meeting_date", { ascending: false }),
    supabase.from("action_items").select("*"),
  ]);

  const props = (properties ?? []) as Pick<Property, "id" | "address" | "portfolio">[];
  const disc = (disciplines ?? []) as Pick<Discipline, "property_id" | "open_comments">[];
  const docs = (documents ?? []) as Pick<PropertyDocument, "id" | "property_id" | "title" | "status" | "due_date" | "assignee">[];
  const pays = (payments ?? []) as Pick<
    Payment,
    "id" | "property_id" | "description" | "amount" | "currency" | "due_date" | "status" | "payment_type" | "quickbooks_code"
  >[];
  const genPays = (generalPayments ?? []) as Pick<
    Payment,
    "id" | "description" | "amount" | "currency" | "due_date" | "status" | "payment_type" | "quickbooks_code"
  >[];
  const mtgs = (meetings ?? []) as Meeting[];
  const items = (actionItems ?? []) as ActionItem[];

  const addrOf = new Map(props.map((p) => [p.id, p.address]));
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const in14 = new Date(today.getTime() + 14 * DAY).toISOString().slice(0, 10);

  // -- KPIs --
  const openComments = disc.reduce((s, d) => s + (d.open_comments ?? 0), 0);
  const pendingDocs = docs.filter((d) => d.status === "Pending" || d.status === "In Progress");
  const openItems = items.filter((i) => !i.done);

  // -- consolidated pending payments (permits + general), sorted by due date --
  const isPending = (s: string) => s === "Pending" || s === "Overdue";
  const pendingPayments: PendingItem[] = [
    ...pays.filter((p) => isPending(p.status)).map((p) => ({
      id: p.id,
      source: addrOf.get(p.property_id) ?? "Propiedad",
      description: p.description,
      amount: Number(p.amount || 0),
      currency: p.currency ?? "USD",
      due_date: p.due_date,
      status: p.status as "Pending" | "Overdue",
      payment_type: p.payment_type,
      quickbooks_code: p.quickbooks_code,
      href: `/permisos?prop=${p.property_id}`,
    })),
    ...genPays.filter((p) => isPending(p.status)).map((p) => ({
      id: p.id,
      source: "General",
      description: p.description,
      amount: Number(p.amount || 0),
      currency: p.currency ?? "USD",
      due_date: p.due_date,
      status: p.status as "Pending" | "Overdue",
      payment_type: p.payment_type,
      quickbooks_code: p.quickbooks_code,
      href: "/pagos",
    })),
  ].sort((a, b) => {
    if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
    if (a.due_date) return -1; // dated first, undated last
    if (b.due_date) return 1;
    return 0;
  });

  // -- open comments per property (for attention + linking) --
  const openByProp = new Map<string, number>();
  for (const d of disc) openByProp.set(d.property_id, (openByProp.get(d.property_id) ?? 0) + (d.open_comments ?? 0));

  // -- Necesita atención (priority order, mixed across modules) --
  type Att = { level: "urgent" | "note"; title: string; subtitle: string; href: string };
  const urgent: Att[] = [];

  for (const p of pays) {
    const overdue = p.status === "Overdue" || (p.status === "Pending" && p.due_date && p.due_date < todayStr);
    const soon = p.status === "Pending" && p.due_date && p.due_date >= todayStr && p.due_date <= in14;
    if (overdue || soon)
      urgent.push({
        level: "urgent",
        title: p.description,
        subtitle: `${addrOf.get(p.property_id) ?? ""} · $${Number(p.amount).toLocaleString("en-US")} · ${overdue ? "vencido" : `vence ${p.due_date}`}`,
        href: `/permisos?prop=${p.property_id}`,
      });
  }
  for (const d of docs) {
    if (d.due_date && d.due_date < todayStr && d.status !== "Approved" && d.status !== "N/A")
      urgent.push({
        level: "urgent",
        title: d.title,
        subtitle: `${addrOf.get(d.property_id) ?? ""} · documento vencido${d.assignee ? ` · ${d.assignee}` : ""}`,
        href: `/permisos?prop=${d.property_id}`,
      });
  }
  for (const it of openItems) {
    if (it.due_date && it.due_date <= in14)
      urgent.push({
        level: "urgent",
        title: it.text,
        subtitle: `Action item · ${it.due_date < todayStr ? "vencido" : `vence ${it.due_date}`}${it.assignee ? ` · ${it.assignee}` : ""}`,
        href: `/seguimiento`,
      });
  }

  // top properties by open comments
  const topProps = [...openByProp.entries()]
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id, n]): Att => ({
      level: n >= 50 ? "urgent" : "note",
      title: addrOf.get(id) ?? "Propiedad",
      subtitle: `${n} comentarios iBuild abiertos`,
      href: `/permisos?prop=${id}`,
    }));

  // pending documents (no due date) to round out the list
  const pendingDocItems = pendingDocs
    .filter((d) => !d.due_date)
    .map((d): Att => ({
      level: "note",
      title: d.title,
      subtitle: `${addrOf.get(d.property_id) ?? ""} · pendiente${d.assignee ? ` · ${d.assignee}` : ""}`,
      href: `/permisos?prop=${d.property_id}`,
    }));

  const attention = [...urgent, ...topProps, ...pendingDocItems].slice(0, 5);

  // -- last meeting --
  const lastMeeting = mtgs[0] ?? null;
  const lastMeetingOpen = lastMeeting
    ? items.filter((i) => i.meeting_id === lastMeeting.id && !i.done).length
    : 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Resumen</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Lo más urgente en todos los módulos. Cada elemento enlaza a su origen.
        </p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard value={openComments} label="Comentarios iBuild abiertos" hint="de todas las disciplinas" href="/permisos" />
        <KpiCard value={pendingDocs.length} label="Documentos pendientes" hint="por entregar" href="/permisos" />
        <PendingPaymentsCard items={pendingPayments} />
        <KpiCard value={openItems.length} label="Action items abiertos" hint="de reuniones" href="/seguimiento" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Necesita atención */}
        <div className="rounded-xl border border-line bg-card">
          <div className="border-b border-line px-5 py-3 text-sm font-semibold">Necesita atención</div>
          {attention.length === 0 ? (
            <div className="px-5 py-6 text-sm text-neutral-500">Nada urgente ahora mismo. 🎉</div>
          ) : (
            <ul className="divide-y divide-line">
              {attention.map((a, i) => (
                <li key={i}>
                  <Link href={a.href} className="flex items-start gap-3 px-5 py-3 hover:bg-page/50">
                    <span
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${a.level === "urgent" ? "bg-[#a32d2d]" : "bg-[#854f0b]"}`}
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{a.title}</span>
                      <span className="block text-xs text-neutral-500">{a.subtitle}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Última reunión */}
        <div className="rounded-xl border border-line bg-card">
          <div className="border-b border-line px-5 py-3 text-sm font-semibold">Última reunión</div>
          <div className="px-5 py-4">
            {lastMeeting ? (
              <Link href="/seguimiento" className="block">
                <div className="text-xs text-neutral-400">{lastMeeting.meeting_date}</div>
                <div className="mt-0.5 font-medium">{lastMeeting.title}</div>
                {lastMeeting.participants && (
                  <div className="mt-0.5 text-xs text-neutral-500">{lastMeeting.participants}</div>
                )}
                <div className="mt-2">
                  {lastMeetingOpen > 0 ? (
                    <span className="badge badge-danger">{lastMeetingOpen} action items abiertos</span>
                  ) : (
                    <span className="badge badge-success">Sin pendientes</span>
                  )}
                </div>
              </Link>
            ) : (
              <div className="text-sm text-neutral-500">
                Sin reuniones todavía.{" "}
                <Link href="/seguimiento" className="text-brand hover:underline">Crear una →</Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ value, label, hint, href }: { value: number; label: string; hint: string; href: string }) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-line bg-card p-4 transition-all hover:border-neutral-300 hover:shadow-sm"
    >
      <div className="text-3xl font-semibold text-brand">{value}</div>
      <div className="mt-2 text-sm font-medium">{label}</div>
      <div className="text-xs text-neutral-400">{hint}</div>
    </Link>
  );
}
