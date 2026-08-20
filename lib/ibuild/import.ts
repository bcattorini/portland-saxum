// Server-side iBuild importer. Batched (few DB round-trips) so it fits within
// the serverless time limit. Never touches comment_tracking / comment_notes.
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseReport, CODE_NAME } from "./parse";

const norm = (s: string | null | undefined) => (s || "").replace(/[^a-z0-9]/gi, "").toLowerCase();

export type FileInput = { name: string; data: Uint8Array };
export type FileSummary = {
  filename: string;
  permit: string | null;
  matched: boolean;
  propertyAddress?: string;
  toUpdate: number;
  toInsert: number;
  staleKept: number;
  resolvedThisImport: number;
  newComments: number;
  trackedPreserved: number[];
  disciplinesToCreate: string[];
  applied: boolean;
  cycleNo?: number;
  unresolvedAfter?: number;
  error?: string;
};

type ExistRow = { id: string; ref_number: number | null; city_status: string; discipline_id: string; cycle: number | null };

export async function importReports(sb: SupabaseClient, files: FileInput[], apply: boolean): Promise<FileSummary[]> {
  const out: FileSummary[] = [];
  const { data: allProps } = await sb.from("properties").select("id,address,permit_number");
  const props = allProps ?? [];

  for (const file of files) {
    const summary: FileSummary = {
      filename: file.name, permit: null, matched: false, toUpdate: 0, toInsert: 0, staleKept: 0,
      resolvedThisImport: 0, newComments: 0, trackedPreserved: [], disciplinesToCreate: [], applied: false,
    };
    try {
      const { permit, records } = await parseReport(file.data);
      summary.permit = permit;
      const kept = records.filter((r) => r.code && r.code !== "SKIP");
      const prop = props.find((p: { permit_number: string | null }) => norm(p.permit_number) === norm(permit));
      if (!prop) { out.push(summary); continue; }
      summary.matched = true;
      summary.propertyAddress = prop.address;

      const { data: discRows0 } = await sb.from("disciplines").select("id,code").eq("property_id", prop.id);
      const discByCode = new Map<string, string>((discRows0 ?? []).map((d: { code: string; id: string }) => [d.code, d.id]));
      const discIds = (discRows0 ?? []).map((d: { id: string }) => d.id);
      const { data: existRows0 } = await sb.from("comments")
        .select("id,ref_number,city_status,discipline_id,cycle")
        .in("discipline_id", discIds.length ? discIds : ["00000000-0000-0000-0000-000000000000"]);
      const existRows = (existRows0 ?? []) as ExistRow[];
      const existByRef = new Map<number, ExistRow>(existRows.map((c) => [c.ref_number as number, c]));

      const trackedIds = new Set<string>();
      if (existRows.length) {
        const { data: trk } = await sb.from("comment_tracking").select("comment_id").in("comment_id", existRows.map((c) => c.id));
        for (const t of trk ?? []) trackedIds.add((t as { comment_id: string }).comment_id);
      }

      const codesInPdf = [...new Set(kept.map((r) => r.code as string))];
      summary.disciplinesToCreate = codesInPdf.filter((c) => !discByCode.has(c));

      const pdfRefs = new Set(kept.map((r) => r.ref));
      for (const r of kept) {
        const ex = existByRef.get(r.ref);
        if (ex) {
          summary.toUpdate++;
          const newStatus = r.status || ex.city_status || "Unresolved";
          if (ex.city_status !== "Resolved" && newStatus === "Resolved") summary.resolvedThisImport++;
          if (trackedIds.has(ex.id)) summary.trackedPreserved.push(r.ref);
        } else summary.toInsert++;
      }
      summary.newComments = summary.toInsert;
      summary.staleKept = existRows.filter((c) => !pdfRefs.has(c.ref_number as number)).length;
      summary.trackedPreserved.sort((a, b) => a - b);

      if (!apply) { out.push(summary); continue; }

      // 1) create missing disciplines
      const toCreate = summary.disciplinesToCreate.map((code) => ({
        property_id: prop.id, code, name: CODE_NAME[code] || code, city_status: "CORRECTIONS",
        total_comments: 0, open_comments: 0, info_comments: 0,
      }));
      if (toCreate.length) {
        const { data: created } = await sb.from("disciplines").insert(toCreate).select("id,code");
        for (const d of created ?? []) discByCode.set((d as { code: string }).code, (d as { id: string }).id);
      }

      // 2) bulk upsert comments (existing keep their id → tracking preserved; new get fresh ids)
      const commentRows = kept.map((r) => {
        const ex = existByRef.get(r.ref);
        const newStatus = r.status || (ex ? ex.city_status : null) || "Unresolved";
        const newCycle = r.cycle ?? (ex ? ex.cycle : null);
        return {
          id: ex ? ex.id : crypto.randomUUID(),
          discipline_id: discByCode.get(r.code as string),
          ref_number: r.ref, text: r.text, filename: r.filename,
          city_status: newStatus, cycle: newCycle, sort_order: r.ref,
        };
      });
      if (commentRows.length) {
        const { error: upErr } = await sb.from("comments").upsert(commentRows, { onConflict: "id" });
        if (upErr) throw new Error("upsert comments: " + upErr.message);
      }

      // 3) recompute discipline counts from the actual comments now in the DB
      const discNow = (await sb.from("disciplines").select("id").eq("property_id", prop.id)).data ?? [];
      const discIdsNow = discNow.map((d: { id: string }) => d.id);
      const { data: afterComments } = await sb.from("comments").select("discipline_id,city_status")
        .in("discipline_id", discIdsNow.length ? discIdsNow : ["00000000-0000-0000-0000-000000000000"]);
      const after = (afterComments ?? []) as { discipline_id: string; city_status: string }[];
      await Promise.all(discNow.map(async (d: { id: string }) => {
        const cs = after.filter((c) => c.discipline_id === d.id);
        const total = cs.length;
        const open = cs.filter((c) => c.city_status === "Unresolved").length;
        const info = cs.filter((c) => c.city_status === "Info Only" || c.city_status === "Information").length;
        const city_status = total === 0 ? "PENDING_REVIEW" : open > 0 ? "CORRECTIONS" : "APPROVED";
        await sb.from("disciplines").update({ total_comments: total, open_comments: open, info_comments: info, city_status }).eq("id", d.id);
      }));

      // 4) cycle snapshot
      const totalAfter = after.length;
      const unresolvedAfter = after.filter((c) => c.city_status === "Unresolved").length;
      const { data: lastCycle } = await sb.from("comment_cycles").select("cycle_no")
        .eq("property_id", prop.id).order("cycle_no", { ascending: false, nullsFirst: false }).limit(1).maybeSingle();
      const cycleNo = (((lastCycle as { cycle_no: number } | null)?.cycle_no) || 0) + 1;
      await sb.from("comment_cycles").insert({
        property_id: prop.id, cycle_no: cycleNo, source: file.name,
        total_before: existRows.length, unresolved_before: existRows.filter((c) => c.city_status === "Unresolved").length,
        resolved_in_cycle: summary.resolvedThisImport, new_comments: summary.toInsert,
        total_after: totalAfter, unresolved_after: unresolvedAfter,
      });
      summary.applied = true;
      summary.cycleNo = cycleNo;
      summary.unresolvedAfter = unresolvedAfter;
    } catch (e) {
      summary.error = e instanceof Error ? e.message : String(e);
    }
    out.push(summary);
  }
  return out;
}
