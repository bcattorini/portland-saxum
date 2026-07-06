// ------------------------------------------------------------------
// Portland Saxum — data model (brief §2)
// Enum string literals match the CHECK constraints in the SQL schema.
// ------------------------------------------------------------------

export type Portfolio = "portland_saxum" | "casas";
export type PermitType = "master" | "demo" | "main";

// Discipline-level City status (brief §2, sub-section A)
export type DisciplineCityStatus =
  | "CORRECTIONS"
  | "PENDING_ACTION"
  | "PENDING_REVIEW"
  | "APPROVED";

// Per-comment City status. Normalized to a canonical set — the iBuild PDF
// uses "Unresolved" / "Resolved" / "Info Only" / "Information"; the importer
// maps these into the three canonical values below (brief §10).
export type CommentCityStatus = "UNRESOLVED" | "RESOLVED" | "INFO_ONLY";

// Internal tracking status — what the team edits (brief §2, comment_tracking)
export type InternalStatus =
  | "Pending"
  | "In Progress"
  | "With Architect"
  | "With Engineer"
  | "With Owner"
  | "Submitted"
  | "Resolved";

export type DocumentStatus =
  | "Pending"
  | "In Progress"
  | "Submitted"
  | "Approved"
  | "N/A";

export type PaymentType = "vendor" | "client";
export type PaymentStatus = "Pending" | "Paid" | "Overdue" | "Cancelled";

// ------------------------------------------------------------------
// Row shapes
// ------------------------------------------------------------------

export interface Property {
  id: string;
  portfolio: Portfolio;
  address: string;
  permit_number: string | null;
  permit_type: PermitType | null;
  cycle: number | null;
  workflow_started: string | null; // ISO date
  status_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface Discipline {
  id: string;
  property_id: string;
  code: string; // "B", "Z", "P", "FF", "LI", "S", "MDC", "DRP", "F", "BBL", "E", "MA"
  name: string | null;
  reviewer_name: string | null;
  city_status: DisciplineCityStatus | null;
  total_comments: number;
  open_comments: number;
  info_comments: number;
}

export interface Comment {
  id: string;
  discipline_id: string;
  ref_number: number | null;
  cycle: number | null;
  text: string | null; // verbatim from iBuild (English — keep as-is)
  filename: string | null;
  discussion: string | null;
  city_status: CommentCityStatus;
  created_at: string;
  updated_at: string;
}

export interface CommentTracking {
  id: string;
  comment_id: string;
  assignee: string | null;
  internal_status: InternalStatus;
  notes: string | null;
  updated_at: string;
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
  created_at: string;
}

export interface Meeting {
  id: string;
  title: string;
  participants: string | null;
  meeting_date: string; // ISO date
  notes: string | null;
  created_at: string;
}

export interface ActionItem {
  id: string;
  meeting_id: string;
  text: string;
  assignee: string | null;
  due_date: string | null;
  done: boolean;
  created_at: string;
}
