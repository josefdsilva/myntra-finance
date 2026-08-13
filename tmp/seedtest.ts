import { PERSONAS, buildPersonaBudget, buildPersonaHistory, personaMonthlyIncome } from "../src/lib/personas";
for (const p of PERSONAS) {
  const b = buildPersonaBudget(p);
  const h = buildPersonaHistory(p, b);
  const inc = personaMonthlyIncome(p);
  const fx = b.fixed.reduce((s,r)=>s+r.monthly_amount,0);
  const vr = b.variable.reduce((s,r)=>s+r.monthly_amount,0);
  console.log(p.key.padEnd(24), "in", inc, "fixed", fx, "var", vr, "margin", b.marginPct, "bench", b.fromBenchmark, "rows", h.length);
}
