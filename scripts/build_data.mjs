#!/usr/bin/env node
/* ============================================================
   content/ → data/ 빌드 (앱은 data/만 읽는다)
   node scripts/validate.mjs && node scripts/build_data.mjs
   - 배치 파일을 합쳐 id순 정렬, 모의고사·용어·유형 노트·가이드 복사
   - data/meta.json: enums(토픽 라벨 등) + 문항 수 + 빌드 시각
   ============================================================ */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const C = p => path.join(ROOT, "content", p);
const D = p => path.join(ROOT, "data", p);
const ENUMS = JSON.parse(fs.readFileSync(C("enums.json"), "utf8"));
const read = f => JSON.parse(fs.readFileSync(f, "utf8"));
const batches = dir => fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => /^batch_\d{2}\.json$/.test(f)).sort().map(f => path.join(dir, f)) : [];
const write = (name, data) => { fs.writeFileSync(D(name), JSON.stringify(data) + "\n"); return name; };
fs.mkdirSync(path.join(ROOT, "data"), { recursive: true });

const counts = {};
for (const [sub, spec] of Object.entries(ENUMS.subtests)) {
  const items = batches(C(spec.prefix)).flatMap(read).sort((a, b) => a.id.localeCompare(b.id));
  write(`${spec.prefix}.json`, items); counts[sub] = items.length;
}
const terms = batches(C("terms")).flatMap(read).sort((a, b) => a.id.localeCompare(b.id));
write("terms.json", terms); counts.terms = terms.length;

const topics = {};
for (const [sub, spec] of Object.entries(ENUMS.subtests)) {
  const f = C(`topics/${spec.prefix}.json`); if (fs.existsSync(f)) topics[sub] = read(f);
}
write("topics.json", topics);
const gf = C("guides/guides.json");
write("guides.json", fs.existsSync(gf) ? read(gf) : {});

counts.mocks = [];
for (const L of ENUMS.mockForms) {
  const f = C(`mocks/form_${L}.json`), out = D(`mock_${L}.json`);
  if (fs.existsSync(f)) { write(`mock_${L}.json`, read(f)); counts.mocks.push(L); }
  else if (fs.existsSync(out)) fs.rmSync(out);
}
write("meta.json", { builtAt: new Date().toISOString(), OPT_N: ENUMS.OPT_N, topics: ENUMS.topics, rctQtypes: ENUMS.rctQtypes, counts });
console.log("data/ 빌드 완료:", JSON.stringify(counts));
