#!/usr/bin/env node
/* 문제은행 분포 확인: node scripts/stats.mjs  (토픽·난이도·정답 위치·그림 비율) */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ENUMS = JSON.parse(fs.readFileSync(path.join(ROOT, "content/enums.json"), "utf8"));
const load = f => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, "data", f), "utf8")); } catch { return null; } };
const tally = (arr, fn) => arr.reduce((m, x) => { const k = fn(x); m[k] = (m[k] || 0) + 1; return m; }, {});
for (const [sub, spec] of Object.entries(ENUMS.subtests)) {
  const items = load(`${spec.prefix}.json`) || [];
  console.log(`\n== ${sub} (${items.length}) ==`);
  const t = tally(items, x => x.topic);
  for (const { key, ko } of ENUMS.topics[sub]) console.log(`  ${String(t[key] || 0).padStart(4)}  ${key} (${ko})`);
  console.log("  diff:", JSON.stringify(tally(items, x => x.diff)), " answer:", JSON.stringify(tally(items, x => x.answer)));
  if (sub === "MCT" || sub === "ANIT") console.log("  fig:", JSON.stringify(tally(items.filter(x => x.fig), x => x.fig.type)), `(${items.filter(x => x.fig).length})`);
  if (sub === "RCT") console.log("  qtype:", JSON.stringify(tally(items, x => x.qtype)));
}
const terms = load("terms.json") || [];
console.log(`\n== terms (${terms.length}) ==`, JSON.stringify(tally(terms, x => x.category)));
for (const L of ENUMS.mockForms) { const m = load(`mock_${L}.json`); if (m) console.log(`form_${L}:`, m.sections.map(s => `${s.code} ${s.items.length}`).join(" · ")); }
