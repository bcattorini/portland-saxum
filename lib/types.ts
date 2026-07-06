// ------------------------------------------------------------------
// Portland Saxum — types mirroring the LIVE Supabase schema (introspected
// via scripts/introspect.mjs). This is the source of truth for the app;
// it differs from the brief §2 (that DB was built by an earlier session
// with a more generic, polymorphic model). Enum unions below match the
// Postgres enum labels exactly.
// ------------------------------------------------------------------

export type Portfolio = "portland_saxum" | "casas";

// Raw iBuild values (NOT normalized in this DB)
export type CommentCityStatus =
  | "Unresolved"
  | "Resolved"
  | "Info Only"
  | "Information";

export type DisciplineCityStatus =
  | "CORRECTIONS"
  | "PENDING_ACTION"
  | "PENDING_REVIEW"
  | "APPROVED";

export type InternalStatus =
  | "Pending"
  | "In Progress"
  | "With Architect"
  | "With Engineer"
  | "With Owner"
  | "Submitted"
  | "Resolved";

export const INTERNAL_STATUSES: InternalStatus[] = [
  "Pending",
  "In Progress",
  "With Architect",
  "With Engineer",
  "With Owner",
  "Submitted",
  "Resolved",
];

export type EntityType = "property" | "construction_project";

export type DocumentStatus =
  | "Pending"
  | "In Progress"
  | "Submitted"
  | "Approved"
  | "N/A";

export const DOCUMENT_STATUSES: DocumentStatus[] = [
  "Pending",
  "In Progress",
  "Submitted",
  "Approved",
  "N/A",
];

export type PaymentType = "vendor" | "client";
export type PaymentStatus = "Pending" | "Paid" | "Overdue" | "Cancelled";
export const PAYMENT_STATUSES: PaymentStatus[] = ["Pending", "Paid", "Overdue", "Cancelled"];

// ------------------------------------------------------------------
// Row shapes (live schema)
// ------------------------------------------------------------------

export interface Property {
  id: string;
  portfolio: Portfolio;
  address: string;
  permit_number: string | null;
  cycle: number | null;
  workflow_started: string | null;
  status_note: string | null;
  related_permits: string | null;
  sort_order: number | null;
  created_at: string;
  updated_at: string;
}

export interface Discipline {
  id: string;
  property_id: string;
  code: string;
  name: string | null;
  reviewer_name: string | null;
  city_status: DisciplineCityStatus | null;
  total_comments: number;
  open_comments: number;
  info_comments: number;
  sort_order: number | null;
  created_at: string;
}

export interface Comment {
  id: string;
  discipline_id: string;
  ref_number: number | null;
  text: string | null; // verbatim City text — keep in English
  city_status: CommentCityStatus;
  filename: string | null;
  sort_order: number | null;
  created_at: string;
}

export interface CommentTracking {
  id: string;
  comment_id: string;
  assignee: string | null;
  internal_status: InternalStatus;
  notes: string | null;
  updated_at: string;
  updated_by: string | null;
}

export interface TrackingHistory {
  id: string;
  comment_id: string;
  assignee: string | null;
  internal_status: InternalStatus | null;
  notes: string | null;
  changed_by: string | null;
  changed_at: string;
}

export interface PropertyDocument {
  id: string;
  property_id: string;
  title: string;
  description: string | null;
  status: DocumentStatus;
  assignee: string | null;
  due_date: string | null;
  notes: string | null;
  sort_order: number | null;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  property_id: string;
  description: string;
  payment_type: PaymentType;
  vendor_or_payer: string | null;
  amount: number;
  currency: string;
  due_date: string | null;
  paid_date: string | null;
  status: PaymentStatus;
  quickbooks_code: string | null;
  notes: string | null;
  sort_order: number | null;
  created_at: string;
}

// -- Derived shape used by the property cards (aggregated from disciplines) --
export interface PropertyWithStats extends Property {
  disc_count: number;
  open_sum: number;
  total_sum: number;
  info_sum: number;
}
