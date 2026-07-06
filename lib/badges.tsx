// ------------------------------------------------------------------
// Badge component + status→(color, Spanish label) maps (brief §5 palette,
// §0 language rule: UI labels in Spanish). Aligned to the LIVE schema enums.
// ------------------------------------------------------------------
import type {
  CommentCityStatus,
  DisciplineCityStatus,
  DocumentStatus,
  InternalStatus,
  PaymentStatus,
  PaymentType,
} from "./types";

type BadgeTone =
  | "danger"
  | "amber"
  | "success"
  | "neutral"
  | "cycle1"
  | "cycle2";

const TONE_CLASS: Record<BadgeTone, string> = {
  danger: "badge badge-danger",
  amber: "badge badge-amber",
  success: "badge badge-success",
  neutral: "badge badge-neutral",
  cycle1: "badge badge-cycle1",
  cycle2: "badge badge-cycle2",
};

export function Badge({ tone, label }: { tone: BadgeTone; label: string }) {
  return <span className={TONE_CLASS[tone]}>{label}</span>;
}

// -- Discipline City status ----------------------------------------
const DISCIPLINE_CITY: Record<DisciplineCityStatus, [BadgeTone, string]> = {
  CORRECTIONS: ["danger", "Correcciones"],
  PENDING_ACTION: ["amber", "Acción pendiente"],
  PENDING_REVIEW: ["neutral", "En revisión"],
  APPROVED: ["success", "Aprobado"],
};

export function DisciplineStatusBadge({
  status,
}: {
  status: DisciplineCityStatus | null;
}) {
  if (!status) return <Badge tone="neutral" label="—" />;
  const [tone, label] = DISCIPLINE_CITY[status];
  return <Badge tone={tone} label={label} />;
}

// -- Comment City status (raw iBuild values) -----------------------
const COMMENT_CITY: Record<CommentCityStatus, [BadgeTone, string]> = {
  Unresolved: ["danger", "Sin resolver"],
  Resolved: ["success", "Resuelto"],
  "Info Only": ["neutral", "Informativo"],
  Information: ["neutral", "Informativo"],
};

export function CommentStatusBadge({ status }: { status: CommentCityStatus }) {
  const [tone, label] = COMMENT_CITY[status] ?? (["neutral", status] as [BadgeTone, string]);
  return <Badge tone={tone} label={label} />;
}

// -- Internal tracking status --------------------------------------
const INTERNAL: Record<InternalStatus, [BadgeTone, string]> = {
  Pending: ["danger", "Pendiente"],
  "In Progress": ["amber", "En progreso"],
  "With Architect": ["amber", "Con arquitecto"],
  "With Engineer": ["amber", "Con ingeniero"],
  "With Owner": ["amber", "Con dueño"],
  Submitted: ["cycle1", "Enviado"],
  Resolved: ["success", "Resuelto"],
};

export function internalStatusMeta(status: InternalStatus): [BadgeTone, string] {
  return INTERNAL[status];
}

export function InternalStatusBadge({ status }: { status: InternalStatus }) {
  const [tone, label] = INTERNAL[status];
  return <Badge tone={tone} label={label} />;
}

// -- Document status -----------------------------------------------
const DOCUMENT: Record<DocumentStatus, [BadgeTone, string]> = {
  Pending: ["danger", "Pendiente"],
  "In Progress": ["amber", "En progreso"],
  Submitted: ["cycle1", "Enviado"],
  Approved: ["success", "Aprobado"],
  "N/A": ["neutral", "N/A"],
};

export function DocumentStatusBadge({ status }: { status: DocumentStatus }) {
  const [tone, label] = DOCUMENT[status];
  return <Badge tone={tone} label={label} />;
}

// -- Payment status + type -----------------------------------------
const PAYMENT: Record<PaymentStatus, [BadgeTone, string]> = {
  Pending: ["amber", "Pendiente"],
  Paid: ["success", "Pagado"],
  Overdue: ["danger", "Vencido"],
  Cancelled: ["neutral", "Cancelado"],
};

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const [tone, label] = PAYMENT[status];
  return <Badge tone={tone} label={label} />;
}

export function PaymentTypeBadge({ type }: { type: PaymentType }) {
  return type === "vendor" ? (
    <Badge tone="cycle2" label="Proveedor" />
  ) : (
    <Badge tone="cycle1" label="Cliente" />
  );
}

// -- Cycle badge ---------------------------------------------------
export function CycleBadge({ cycle }: { cycle: number | null }) {
  if (cycle == null) return <Badge tone="neutral" label="Sin ciclo" />;
  const tone: BadgeTone = cycle <= 1 ? "cycle1" : cycle === 2 ? "cycle2" : "neutral";
  return <Badge tone={tone} label={`Ciclo ${cycle}`} />;
}
