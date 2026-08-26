// No user-accounts table. Bruno + Sol have logins; we identify the logged-in
// person by their auth email, and match action items by the free-text
// "responsable" name. Everyone else is just free text.
export type AppPerson = { email: string; name: string; aliases: string[] };

export const PEOPLE: AppPerson[] = [
  { email: "bcattorini@saxuminternational.com", name: "Bruno", aliases: ["bruno"] },
  { email: "sgregor@saxuminternational.com", name: "Sol", aliases: ["sol"] },
];

export function personForEmail(email?: string | null): AppPerson | null {
  if (!email) return null;
  const e = email.toLowerCase();
  return PEOPLE.find((p) => p.email.toLowerCase() === e) ?? null;
}

// Roles. "member" = full access (Bruno / Sol). Restricted roles only see one
// section. Add emails here (lowercase).
//  - "viewer": read-only, Preconstruction only.
//  - "pagos": Pagos only, manages payments (can't approve — that's Bruno).
export type Role = "member" | "viewer" | "pagos";

const ROLE_BY_EMAIL: Record<string, Role> = {
  "lmarin@saxuminternational.com": "viewer",
  "dsinisi@portlandsaxum.com": "pagos",
};

export function roleForEmail(email?: string | null): Role {
  if (!email) return "member";
  return ROLE_BY_EMAIL[email.toLowerCase()] ?? "member";
}

// The only nav section a restricted role may see (null = full access).
export function allowedSection(email?: string | null): string | null {
  switch (roleForEmail(email)) {
    case "viewer": return "/permisos";
    case "pagos": return "/pagos";
    default: return null;
  }
}
export function homePath(email?: string | null): string {
  return allowedSection(email) ?? "/";
}

export function isViewer(email?: string | null): boolean {
  return roleForEmail(email) === "viewer";
}
