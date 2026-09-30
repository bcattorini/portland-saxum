// iBuild pane-side extractor — "agente" semi-automático (probado 30-sep-2026).
//
// CONTEXTO: iBuild (apps.miami.gov) está geo-bloqueado a EE.UU. y necesita la
// sesión logueada de Sol. El ÚNICO lugar donde se dan las dos cosas es el
// navegador interno de Claude (sale con IP de EE.UU. + tiene el login de Sol).
// Node/curl desde la máquina de Sol NO puede con apps.miami.gov (Argentina),
// pero SÍ puede bajar los PDF de avolvecloud (ese dominio no está bloqueado).
//
// FLUJO (cada vez que Sol quiera actualizar):
//   1. Sol se loguea en iBuild en el navegador interno.
//   2. Correr en la consola del navegador (mcp__Claude_Browser__javascript_tool)
//      los DOS lotes de PLANS de abajo (5 + 5). Cada lote < 45s. Devuelven
//      {label, pdf} por proceso. GetReportPDFInfo genera el PDF en ProjectDox,
//      por eso conviene de a 5 en paralelo (10 en serie se pasa del timeout).
//   3. Con esas URLs: curl de cada PDF a Downloads (avolvecloud, sin bloqueo) y
//      node scripts/ibuild-import.mjs <pdfs...> [--apply]
//
// PlanID: es estable por proceso; abajo están los de 30-sep-2026. Si alguno
// cambiara, se re-deriva cargando la pantalla ReviewResult y sacándolo del HTML
// (regex /PlanID['"]?\s*[:=]\s*['"]?(\d+)/i) — ver bloque FALLBACK al final.
// Process numbers y PlanIDs salen de properties.permit_number + iBuild.

// ---- LOTE 1 (pegar en el navegador) -------------------------------------
// await (async () => {
//   const P = [["150_NC","406718"],["150_Demo","407336"],["156_NC","426986"],["156_Demo","435715"],["160_NC","427623"]];
//   return await Promise.all(P.map(async ([label, planId]) => {
//     try { const j = await fetch(`https://apps.miami.gov/iBuildPortal/PlanReview/ReviewResult/GetReportPDFInfo?PlanID=${planId}&ReportType=ChangemarkSummaryReport&_=${Date.now()}`, { credentials: "include" }).then(r => r.json()); return { label, pdf: j.PdfPath }; }
//     catch (e) { return { label, error: String(e) }; }
//   }));
// })();

// ---- LOTE 2 (pegar en el navegador) -------------------------------------
// await (async () => {
//   const P = [["160_Demo","438735"],["3801_NC","418747"],["3201_NC","421256"],["3201_Demo","421257"],["3770_NC","412004"]];
//   return await Promise.all(P.map(async ([label, planId]) => {
//     try { const j = await fetch(`https://apps.miami.gov/iBuildPortal/PlanReview/ReviewResult/GetReportPDFInfo?PlanID=${planId}&ReportType=ChangemarkSummaryReport&_=${Date.now()}`, { credentials: "include" }).then(r => r.json()); return { label, pdf: j.PdfPath }; }
//     catch (e) { return { label, error: String(e) }; }
//   }));
// })();

// ---- REFERENCIA: procesos por propiedad (permit_number) -----------------
// 150 NE 77 St   NC BD25015956001 (PlanID 406718) · Demo BD25016429001 (407336)
// 156 NE 77 St   NC BD25029908001 (426986)        · Demo BD26005137001 (435715)
// 160 NE 77 St   NC BD26000114001 (427623)        · Demo BD26006565001 (438735)
// 3801 Oak Av    NC BD25024765001 (418747)        · Demo final 2014 (sin plan review)
// 3201 Day Av    NC BD25025864001 (421256)        · Demo BD25025865001 (421257)
// 3770 Oak Av    NC BD25019920001 (412004)        · Demo final 2015 (sin plan review)
// 167 NE 76 St   sin permit cargado aún

// ---- FALLBACK: re-derivar PlanID desde el process number ----------------
// Si un PlanID cambió, correr esto en el navegador con el process number
// (sin guiones, ej. BD25015956001) para obtener PlanID + pdf en un paso:
// await (async (proc) => {
//   const html = await fetch(`https://apps.miami.gov/iBuildPortal/PlanReview/ReviewResult/ReviewResult/${proc}?title=Inquire%20Plan`, { credentials: "include" }).then(r => r.text());
//   const m = html.match(/PlanID['"]?\s*[:=]\s*['"]?(\d+)/i); if (!m) return { error: "no PlanID" };
//   const j = await fetch(`https://apps.miami.gov/iBuildPortal/PlanReview/ReviewResult/GetReportPDFInfo?PlanID=${m[1]}&ReportType=ChangemarkSummaryReport&_=${Date.now()}`, { credentials: "include" }).then(r => r.json());
//   return { planId: m[1], pdf: j.PdfPath };
// })("BD25015956001");
