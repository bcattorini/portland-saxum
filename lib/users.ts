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

// Viewer role: read-only access limited to Preconstruction. Add emails here
// (lowercase). Everyone not listed is a full member (Bruno / Sol).
export const VIEWER_EMAILS = new Set<string>([
  "lmarin@saxuminternational.com",
]);

export function isViewer(email?: string | null): boolean {
  return !!email && VIEWER_EMAILS.has(email.toLowerCase());
}
