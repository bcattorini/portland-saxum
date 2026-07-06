const data = require("./_input/extracted.json");
let flags = 0;
for (const p of data) {
  for (const d of p.disciplines) {
    const expected = (d.open_comments||0) + (d.info_comments||0);
    const got = d.comments.length;
    if (expected !== got) {
      flags++;
      console.log(`MISMATCH ${p.address} / ${d.code} ${d.name}: open+info=${expected} comments=${got}`);
    }
  }
}
console.log(flags ? `\n${flags} discipline(s) with count mismatch` : "OK: every discipline's comments == open+info (nothing dropped).");
