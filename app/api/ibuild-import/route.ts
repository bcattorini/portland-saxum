import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isViewer } from "@/lib/users";
import { importReports, type FileInput } from "@/lib/ibuild/import";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  if (isViewer(user.email)) return NextResponse.json({ error: "Sin permiso para importar." }, { status: 403 });

  const form = await request.formData();
  const apply = form.get("apply") === "1";
  const uploaded = form.getAll("files").filter((f): f is File => f instanceof File);
  if (!uploaded.length) return NextResponse.json({ error: "No se recibió ningún archivo." }, { status: 400 });

  const pdfs = uploaded.filter((f) => /\.pdf$/i.test(f.name));
  if (!pdfs.length) return NextResponse.json({ error: "Subí un PDF de iBuild (Review Comments Report)." }, { status: 400 });

  const files: FileInput[] = [];
  for (const f of pdfs) files.push({ name: f.name, data: new Uint8Array(await f.arrayBuffer()) });

  try {
    const results = await importReports(supabase, files, apply);
    return NextResponse.json({ results });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
