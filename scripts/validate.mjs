#!/usr/bin/env node
/* ============================================================
   ASTB-E Prep — content validator
   ------------------------------------------------------------
   node scripts/validate.mjs                 전체 검증 (중복·분포 포함)
   node scripts/validate.mjs <file> [...]    지정 파일만 검증
   node scripts/validate.mjs --strict        배치 문항 수 부족도 오류로 처리
   규격: content/AUTHORING.md · 기준값: content/enums.json
   ============================================================ */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CONTENT = path.join(ROOT, "content");
const ENUMS = JSON.parse(fs.readFileSync(path.join(CONTENT, "enums.json"), "utf8"));
const OPT_N = ENUMS.OPT_N;
const HANGUL = /[가-힣]/;
const SUBS = Object.keys(ENUMS.subtests);                 // MST RCT MCT ANIT
const PREFIX2SUB = Object.fromEntries(SUBS.map(s => [ENUMS.subtests[s].prefix, s]));
const TOPIC_KEYS = Object.fromEntries(SUBS.map(s => [s, ENUMS.topics[s].map(t => t.key)]));
const NAVAL = new Set(["nautical_terms", "ship_types", "carrier_ops", "navy_org_ranks", "seamanship"]);
const MIL_RCT = new Set(["military", "aviation", "naval"]);

const args = process.argv.slice(2);
const STRICT = args.includes("--strict");
const files = args.filter(a => !a.startsWith("--"));

const errors = [];
const warns = [];
const err = (loc, msg) => errors.push(`✗ ${loc}: ${msg}`);
const warn = (loc, msg) => warns.push(`⚠ ${loc}: ${msg}`);
const rel = f => path.relative(ROOT, f);
const isStr = v => typeof v === "string" && v.trim().length > 0;
const isInt = v => Number.isInteger(v);
const isNum = v => typeof v === "number" && Number.isFinite(v);
const norm = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
// 보기 중복 판정은 위첨자(², ³)·음수 부호·기호를 살려서 비교한다 ("x³y²" ≠ "x³y⁴", "4" ≠ "-4")
const normOpt = s => String(s).toLowerCase().replace(/[−–]/g, "-").replace(/\s+/g, " ").trim();
const pct = (n, d) => d ? n / d : 0;

/* ---------- field sets ---------- */
const BANK_FIELDS = {
  MST:  { req: ["id", "topic", "diff", "q", "q_ko", "options", "answer", "explain"], opt: ["tags"] },
  MCT:  { req: ["id", "topic", "diff", "q", "q_ko", "options", "answer", "explain"], opt: ["tags", "fig"] },
  ANIT: { req: ["id", "topic", "diff", "q", "q_ko", "options", "answer", "explain"], opt: ["tags", "fig"] },
  RCT:  { req: ["id", "topic", "diff", "qtype", "title", "passage", "passage_ko", "q", "q_ko", "options", "answer", "explain"], opt: ["tags"] },
};

function checkKeys(loc, obj, req, opt) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) { err(loc, "객체가 아님"); return false; }
  for (const k of req) if (!(k in obj)) err(loc, `필수 필드 누락: ${k}`);
  const allowed = new Set([...req, ...opt]);
  for (const k of Object.keys(obj)) if (!allowed.has(k)) err(loc, `알 수 없는 필드: ${k}`);
  return true;
}

/* ---------- figure (MCT · ANIT) ---------- */
const FIG_TYPES = { MCT: ENUMS.figTypes, ANIT: ENUMS.anitFigTypes };
const PARTS = ENUMS.figParts;
function checkFig(loc, f, sub) {
  if (!f || typeof f !== "object") return err(loc, "fig가 객체가 아님");
  const T = f.type;
  if (!FIG_TYPES[sub].includes(T)) return err(loc, `fig.type 허용 안 됨(${sub}): ${T}`);
  const only = (keys) => { for (const k of Object.keys(f)) if (!["type", ...keys].includes(k)) err(loc, `fig(${T}) 알 수 없는 필드: ${k}`); };
  const labelled = (arr, what) => Array.isArray(arr) && arr.every(x => x && isStr(x.label)) || err(loc, `fig(${T}) ${what} 라벨 필요`);
  switch (T) {
    case "lever": {
      only(["length", "fulcrum", "unit", "items"]);
      if (!isNum(f.length) || f.length <= 0) err(loc, "lever.length > 0 숫자");
      if (!isNum(f.fulcrum) || f.fulcrum < 0 || f.fulcrum > f.length) err(loc, "lever.fulcrum은 0..length");
      if (!Array.isArray(f.items) || f.items.length < 1 || f.items.length > 4) err(loc, "lever.items 1–4개");
      else f.items.forEach((it, i) => {
        if (!isNum(it.x) || it.x < 0 || it.x > f.length) err(loc, `lever.items[${i}].x 범위`);
        if (!isStr(it.label)) err(loc, `lever.items[${i}].label`);
        if (!["weight", "force"].includes(it.kind)) err(loc, `lever.items[${i}].kind weight|force`);
        if (it.dir != null && !["up", "down"].includes(it.dir)) err(loc, `lever.items[${i}].dir up|down`);
        for (const k of Object.keys(it)) if (!["x", "label", "kind", "dir"].includes(k)) err(loc, `lever.items[${i}] 알 수 없는 필드 ${k}`);
      });
      break;
    }
    case "pulley":
      only(["strands", "load", "effort"]);
      if (!isInt(f.strands) || f.strands < 1 || f.strands > 6) err(loc, "pulley.strands 1–6 정수");
      if (!isStr(f.load) || !isStr(f.effort)) err(loc, "pulley.load/effort 문자열");
      break;
    case "gears": {
      only(["gears", "driver", "dir", "ask"]);
      if (!Array.isArray(f.gears) || f.gears.length < 2 || f.gears.length > 5) { err(loc, "gears.gears 2–5개"); break; }
      labelled(f.gears, "gears");
      f.gears.forEach((g, i) => { if (!isInt(g.teeth) || g.teeth < 6 || g.teeth > 80) err(loc, `gears[${i}].teeth 6–80`); });
      const labels = f.gears.map(g => g.label);
      if (!labels.includes(f.driver)) err(loc, "gears.driver는 기어 라벨이어야 함");
      if (!["cw", "ccw"].includes(f.dir)) err(loc, "gears.dir cw|ccw");
      if (f.ask != null && !labels.includes(f.ask)) err(loc, "gears.ask는 기어 라벨이어야 함");
      break;
    }
    case "belt": {
      only(["pulleys", "unit", "crossed", "driver", "dir", "ask"]);
      if (!Array.isArray(f.pulleys) || f.pulleys.length !== 2) { err(loc, "belt.pulleys 정확히 2개"); break; }
      labelled(f.pulleys, "pulleys");
      f.pulleys.forEach((p, i) => { if (!isNum(p.d) || p.d < 1 || p.d > 20) err(loc, `belt.pulleys[${i}].d 1–20`); });
      if (typeof f.crossed !== "boolean") err(loc, "belt.crossed boolean");
      const labels = f.pulleys.map(p => p.label);
      if (!labels.includes(f.driver)) err(loc, "belt.driver 라벨");
      if (!["cw", "ccw"].includes(f.dir)) err(loc, "belt.dir cw|ccw");
      if (f.ask != null && !labels.includes(f.ask)) err(loc, "belt.ask 라벨");
      break;
    }
    case "incline":
      only(["length", "height", "base", "load", "force"]);
      if (!isStr(f.height)) err(loc, "incline.height 필수");
      if (!isStr(f.length) && !isStr(f.base)) err(loc, "incline.length 또는 base 필요");
      if (!isStr(f.load)) err(loc, "incline.load 필수");
      break;
    case "hydraulic":
      only(["small", "large"]);
      for (const s of ["small", "large"]) if (!f[s] || !isStr(f[s].area) || !isStr(f[s].force)) err(loc, `hydraulic.${s}.area/force 문자열`);
      break;
    case "circuit":
      only(["mode", "source", "resistors"]);
      if (!["series", "parallel"].includes(f.mode)) err(loc, "circuit.mode series|parallel");
      if (!isStr(f.source)) err(loc, "circuit.source");
      if (!Array.isArray(f.resistors) || f.resistors.length < 1 || f.resistors.length > 4 || !f.resistors.every(isStr)) err(loc, "circuit.resistors 1–4개 문자열");
      break;
    case "springs":
      only(["mode", "springs", "load"]);
      if (!["series", "parallel"].includes(f.mode)) err(loc, "springs.mode series|parallel");
      if (!Array.isArray(f.springs) || f.springs.length < 2 || f.springs.length > 3 || !f.springs.every(isStr)) err(loc, "springs.springs 2–3개 문자열");
      if (!isStr(f.load)) err(loc, "springs.load");
      break;
    case "pipe":
      only(["sections", "unit", "flow"]);
      if (!Array.isArray(f.sections) || f.sections.length < 2 || f.sections.length > 3) { err(loc, "pipe.sections 2–3개"); break; }
      labelled(f.sections, "sections");
      f.sections.forEach((s, i) => { if (!isNum(s.d) || s.d <= 0 || s.d > 20) err(loc, `pipe.sections[${i}].d`); });
      if (!["right", "left"].includes(f.flow)) err(loc, "pipe.flow right|left");
      break;
    case "beam": {
      only(["length", "unit", "supports", "loads"]);
      if (!isNum(f.length) || f.length <= 0) { err(loc, "beam.length > 0 숫자"); break; }
      const inR = (x) => isNum(x) && x >= 0 && x <= f.length;
      if (!Array.isArray(f.supports) || f.supports.length !== 2) err(loc, "beam.supports 정확히 2개");
      else f.supports.forEach((s, i) => { if (!inR(s.x) || !isStr(s.label)) err(loc, `beam.supports[${i}] {x(0..length), label}`);
        for (const k of Object.keys(s)) if (!["x", "label"].includes(k)) err(loc, `beam.supports[${i}] 알 수 없는 필드 ${k}`); });
      if (!Array.isArray(f.loads) || f.loads.length < 1 || f.loads.length > 3) err(loc, "beam.loads 1–3개");
      else f.loads.forEach((s, i) => { if (!inR(s.x) || !isStr(s.label)) err(loc, `beam.loads[${i}] {x(0..length), label}`);
        for (const k of Object.keys(s)) if (!["x", "label"].includes(k)) err(loc, `beam.loads[${i}] 알 수 없는 필드 ${k}`); });
      break;
    }
    case "tank": {
      only(["tanks", "holes", "level"]);
      if ((f.tanks != null) === (f.holes != null)) { err(loc, "tank은 tanks 또는 holes 중 하나만"); break; }
      if (f.tanks != null) {
        if (f.level != null) err(loc, "tank.level은 holes 모드에서만");
        if (!Array.isArray(f.tanks) || f.tanks.length < 1 || f.tanks.length > 4) { err(loc, "tank.tanks 1–4개"); break; }
        f.tanks.forEach((t, i) => {
          if (!["rect", "wide", "flare", "taper"].includes(t.shape)) err(loc, `tank.tanks[${i}].shape rect|wide|flare|taper`);
          if (!isNum(t.level) || t.level < 0.05 || t.level > 1) err(loc, `tank.tanks[${i}].level 0.05–1`);
          if (!isStr(t.label)) err(loc, `tank.tanks[${i}].label`);
          if (t.note != null && !isStr(t.note)) err(loc, `tank.tanks[${i}].note 문자열`);
          for (const k of Object.keys(t)) if (!["shape", "level", "label", "note"].includes(k)) err(loc, `tank.tanks[${i}] 알 수 없는 필드 ${k}`);
        });
      } else {
        if (!isNum(f.level) || f.level < 0.1 || f.level > 1) err(loc, "tank.level 0.1–1 (holes 모드 수위)");
        if (!Array.isArray(f.holes) || f.holes.length < 2 || f.holes.length > 4) { err(loc, "tank.holes 2–4개"); break; }
        f.holes.forEach((h, i) => {
          if (!isNum(h.h) || h.h < 0 || h.h >= (isNum(f.level) ? f.level : 1)) err(loc, `tank.holes[${i}].h 0 이상, 수위(level) 미만`);
          if (!isStr(h.label)) err(loc, `tank.holes[${i}].label`);
          for (const k of Object.keys(h)) if (!["h", "label"].includes(k)) err(loc, `tank.holes[${i}] 알 수 없는 필드 ${k}`);
        });
      }
      break;
    }
    case "wheel":
      only(["wheel", "axle", "load", "effort"]);
      for (const k of ["wheel", "axle", "load", "effort"]) if (!isStr(f[k])) err(loc, `wheel.${k} 문자열 필수`);
      break;
    case "attitude":
      only(["bank", "pitch"]);
      if (!isNum(f.bank) || f.bank < -90 || f.bank > 90) err(loc, "attitude.bank −90..90 (+ = 오른쪽 경사)");
      if (!isNum(f.pitch) || f.pitch < -25 || f.pitch > 25) err(loc, "attitude.pitch −25..25 (+ = 기수 들림)");
      break;
    case "heading":
      only(["hdg"]);
      if (!isInt(f.hdg) || f.hdg < 0 || f.hdg > 359) err(loc, "heading.hdg 0–359 정수");
      break;
    case "aircraft": {
      only(["view", "labels"]);
      if (!["top", "side"].includes(f.view)) { err(loc, "aircraft.view top|side"); break; }
      checkParts(loc, f.labels, PARTS["aircraft_" + f.view], "aircraft", 1);
      break;
    }
    case "ship":
      only(["labels"]);
      checkParts(loc, f.labels, PARTS.ship, "ship", 1);
      break;
    case "runway": {
      only(["num", "labels", "displaced", "blastpad"]);
      if (!isStr(f.num) || !/^(0?[1-9]|[12]\d|3[0-6])[LRC]?$/.test(f.num)) err(loc, "runway.num 01–36 (+L/R/C)");
      for (const k of ["displaced", "blastpad"]) if (f[k] != null && typeof f[k] !== "boolean") err(loc, `runway.${k} boolean`);
      checkParts(loc, f.labels || [], PARTS.runway, "runway", 0);
      const used = (f.labels || []).map(l => l && l.part);
      if (used.includes("displaced_threshold") && !f.displaced) err(loc, "displaced_threshold 라벨은 displaced:true 필요");
      if (used.includes("blast_pad") && !f.blastpad) err(loc, "blast_pad 라벨은 blastpad:true 필요");
      break;
    }
    case "papi":
      only(["white"]);
      if (!isInt(f.white) || f.white < 0 || f.white > 4) err(loc, "papi.white 0–4 정수");
      break;
  }
}
function checkParts(loc, labels, allowed, what, min) {
  if (!Array.isArray(labels) || labels.length < min || labels.length > 4) return err(loc, `${what}.labels ${min}–4개`);
  const seenP = new Set(), seenL = new Set();
  labels.forEach((l, i) => {
    if (!l || !allowed.includes(l.part)) err(loc, `${what}.labels[${i}].part 허용 안 됨: ${l && l.part} (가능: ${allowed.join(", ")})`);
    if (!l || !isStr(l.label)) err(loc, `${what}.labels[${i}].label 필요`);
    if (l) { if (seenP.has(l.part)) err(loc, `${what}.labels 부위 중복: ${l.part}`); seenP.add(l.part);
      if (seenL.has(l.label)) err(loc, `${what}.labels 라벨 중복: ${l.label}`); seenL.add(l.label);
      for (const k of Object.keys(l)) if (!["part", "label"].includes(k)) err(loc, `${what}.labels[${i}] 알 수 없는 필드 ${k}`); }
  });
}

/* ---------- one question ---------- */
function checkItem(sub, it, loc) {
  const F = BANK_FIELDS[sub];
  if (!checkKeys(loc, it, F.req, F.opt)) return;
  if (!TOPIC_KEYS[sub].includes(it.topic)) err(loc, `topic 허용 안 됨: ${it.topic}`);
  if (![1, 2, 3, 4].includes(it.diff)) err(loc, "diff는 1|2|3|4");
  if (!isStr(it.q)) err(loc, "q 비어 있음");
  else if (HANGUL.test(it.q)) err(loc, "q에 한글 포함 (영어 문항이어야 함)");
  if (!isStr(it.q_ko) || !HANGUL.test(it.q_ko)) err(loc, "q_ko에 한국어 번역 필요");
  if (!Array.isArray(it.options) || it.options.length !== OPT_N) err(loc, `options는 정확히 ${OPT_N}개`);
  else {
    it.options.forEach((o, i) => {
      if (!isStr(o)) return err(loc, `options[${i}] 비어 있음`);
      if (/\b(all|none) of the above\b|\bboth [a-d] and [a-d]\b/i.test(o)) err(loc, `options[${i}] 금지 보기: ${o}`);
      if (/^\(?[A-Da-d][).:]\s/.test(o)) err(loc, `options[${i}] 앞에 기호 금지: ${o}`);
    });
    const n = it.options.map(normOpt);
    if (new Set(n).size !== n.length) err(loc, "options 중복");
  }
  if (!isInt(it.answer) || it.answer < 0 || it.answer >= OPT_N) err(loc, `answer는 0..${OPT_N - 1} 정수`);
  if (!isStr(it.explain) || !HANGUL.test(it.explain) || it.explain.trim().length < 20) err(loc, "explain은 한국어 20자 이상");
  if (it.tags != null && !(Array.isArray(it.tags) && it.tags.every(isStr))) err(loc, "tags는 문자열 배열");
  if (sub === "RCT") {
    if (!ENUMS.rctQtypes.includes(it.qtype)) err(loc, `qtype 허용 안 됨: ${it.qtype}`);
    if (!isStr(it.title)) err(loc, "title 필요");
    if (isStr(it.passage)) {
      if (HANGUL.test(it.passage)) err(loc, "passage에 한글 포함");
      const wc = it.passage.trim().split(/\s+/).length;
      if (wc < 60 || wc > 200) err(loc, `passage 단어 수 ${wc} (60–200)`);
      else if (wc < 80 || wc > 170) warn(loc, `passage 단어 수 ${wc} (권장 80–170)`);
    } else err(loc, "passage 비어 있음");
    if (!isStr(it.passage_ko) || !HANGUL.test(it.passage_ko)) err(loc, "passage_ko 한국어 번역 필요");
  }
  if (it.fig != null) {
    if (!FIG_TYPES[sub]) err(loc, "fig는 MCT·ANIT만 허용");
    else checkFig(loc, it.fig, sub);
  }
}

/* ---------- distributions for a group of items ---------- */
function checkDistribution(sub, items, loc) {
  const n = items.length;
  if (n < 20) return;
  const pos = [0, 0, 0, 0];
  items.forEach(it => { if (isInt(it.answer) && it.answer >= 0 && it.answer < OPT_N) pos[it.answer]++; });
  const maxShare = Math.max(...pos) / n;
  if (maxShare > 0.35) err(loc, `정답 위치 편중 ${pos.join("/")} (최대 ${(maxShare * 100).toFixed(0)}% > 35%)`);
  const d = [1, 2, 3, 4].map(k => pct(items.filter(it => it.diff === k).length, n));
  const show = d.map(x => (x * 100).toFixed(0) + "%").join("/");
  if (d[3] > 0) {   // 상위권 배치(난이도 4 포함): 적응형 상단 문항 풀 보강용
    if (d[0] > 0.1 || d[1] < 0.1 || d[1] > 0.35 || d[2] < 0.35 || d[2] > 0.65 || d[3] < 0.15 || d[3] > 0.45)
      warn(loc, `상위권 배치 난이도 분포 ${show} (권장 0/20/50/30)`);
  } else if (d[0] < 0.15 || d[0] > 0.45 || d[1] < 0.3 || d[1] > 0.7 || d[2] < 0.08 || d[2] > 0.4)
    warn(loc, `난이도 분포 ${show} (권장 30/50/20/0)`);
  const used = new Set(items.map(it => it.topic));
  const missing = TOPIC_KEYS[sub].filter(k => !used.has(k));
  if (n >= 40 && missing.length && !(d[3] > 0)) warn(loc, `빠진 토픽: ${missing.join(", ")}`);
  if (sub === "RCT") {
    const inf = pct(items.filter(it => it.qtype === "inference").length, n);
    if (inf < 0.7) warn(loc, `inference 비율 ${(inf * 100).toFixed(0)}% (권장 ≥80%)`);
    const mil = pct(items.filter(it => MIL_RCT.has(it.topic)).length, n);
    if (mil < 0.35) warn(loc, `군사·항공·해군 지문 비율 ${(mil * 100).toFixed(0)}% (권장 ≥40%)`);
  }
  if (sub === "MCT") {
    const fr = pct(items.filter(it => it.fig).length, n);
    if (fr < 0.3 || fr > 0.5) warn(loc, `그림 문항 비율 ${(fr * 100).toFixed(0)}% (권장 35–45%)`);
  }
  if (sub === "ANIT") {
    const nv = pct(items.filter(it => NAVAL.has(it.topic)).length, n);
    if (nv < 0.35) warn(loc, `해상 계열 비율 ${(nv * 100).toFixed(0)}% (권장 ≥40%)`);
  }
}

/* ---------- file kinds ---------- */
const readJSON = f => {
  try { return JSON.parse(fs.readFileSync(f, "utf8")); }
  catch (e) { err(rel(f), `JSON 파싱 실패: ${e.message}`); return undefined; }
};

const seenIds = new Map();      // id -> loc
const seenStems = new Map();    // normalized key -> loc
const seenTerms = new Map();
function trackId(id, loc) {
  if (!isStr(id)) return;
  if (seenIds.has(id)) err(loc, `id 중복: ${id} (이미 ${seenIds.get(id)})`);
  else seenIds.set(id, loc);
}
function trackStem(sub, it, loc) {
  let key;
  if (sub === "RCT") { if (!isStr(it.passage)) return; key = "RCT|" + norm(it.passage).slice(0, 240); }
  else { if (!isStr(it.q) || !Array.isArray(it.options)) return; key = sub + "|" + norm(it.q) + "|" + it.options.map(normOpt).join("|") + (it.fig ? "|" + JSON.stringify(it.fig) : ""); }
  if (seenStems.has(key)) err(loc, `중복 문항 (이미 ${seenStems.get(key)})`);
  else seenStems.set(key, loc);
}

function validateBank(file, sub) {
  const data = readJSON(file); if (data === undefined) return;
  const R = rel(file);
  if (!Array.isArray(data)) return err(R, "JSON 배열이어야 함");
  const m = path.basename(file).match(/^batch_(\d{2})\.json$/);
  if (!m) return err(R, "파일명은 batch_NN.json");
  const nn = Number(m[1]);
  const { prefix, batchSize } = ENUMS.subtests[sub];
  const lo = (nn - 1) * batchSize + 1, hi = nn * batchSize;
  if (data.length !== batchSize) (STRICT ? err : warn)(R, `문항 수 ${data.length} (배치 크기 ${batchSize})`);
  const idRe = new RegExp(`^${prefix}_(\\d{4})$`);
  data.forEach((it, i) => {
    const loc = `${R}#${i}${it && it.id ? `(${it.id})` : ""}`;
    checkItem(sub, it, loc);
    const mm = it && typeof it.id === "string" && it.id.match(idRe);
    if (!mm) err(loc, `id 형식 ${prefix}_0000`);
    else if (Number(mm[1]) < lo || Number(mm[1]) > hi) err(loc, `id 범위 밖 (${lo}–${hi})`);
    trackId(it && it.id, loc);
    if (it) trackStem(sub, it, loc);
  });
  checkDistribution(sub, data, R);
}

function validateTerms(file) {
  const data = readJSON(file); if (data === undefined) return;
  const R = rel(file);
  if (!Array.isArray(data)) return err(R, "JSON 배열이어야 함");
  const m = path.basename(file).match(/^batch_(\d{2})\.json$/);
  if (!m) return err(R, "파일명은 batch_NN.json");
  const nn = Number(m[1]); const { batchSize } = ENUMS.termBatches;
  const lo = (nn - 1) * batchSize + 1, hi = nn * batchSize;
  if (data.length !== batchSize) (STRICT ? err : warn)(R, `용어 수 ${data.length} (배치 크기 ${batchSize})`);
  let naval = 0;
  data.forEach((t, i) => {
    const loc = `${R}#${i}${t && t.id ? `(${t.id})` : ""}`;
    if (!checkKeys(loc, t, ["id", "term", "ko", "def", "def_ko", "category"], [])) return;
    const mm = typeof t.id === "string" && t.id.match(/^t_(\d{4})$/);
    if (!mm) err(loc, "id 형식 t_0000");
    else if (Number(mm[1]) < lo || Number(mm[1]) > hi) err(loc, `id 범위 밖 (${lo}–${hi})`);
    trackId(t.id, loc);
    if (!isStr(t.term) || HANGUL.test(t.term)) err(loc, "term은 영어");
    if (!isStr(t.ko) || !HANGUL.test(t.ko)) err(loc, "ko 한국어");
    if (!isStr(t.def) || HANGUL.test(t.def)) err(loc, "def는 영어");
    if (!isStr(t.def_ko) || !HANGUL.test(t.def_ko)) err(loc, "def_ko 한국어");
    if (!TOPIC_KEYS.ANIT.includes(t.category)) err(loc, `category는 ANIT 토픽 키: ${t.category}`);
    if (NAVAL.has(t.category)) naval++;
    if (isStr(t.term)) {
      const k = norm(t.term.replace(/\(.*?\)/g, ""));
      if (seenTerms.has(k)) err(loc, `용어 중복: ${t.term} (이미 ${seenTerms.get(k)})`);
      else seenTerms.set(k, loc);
    }
  });
  if (data.length >= 50 && naval / data.length < 0.4) warn(R, `해상 계열 비율 ${(naval / data.length * 100).toFixed(0)}% (권장 ≥45%)`);
}

function validateMock(file) {
  const data = readJSON(file); if (data === undefined) return;
  const R = rel(file);
  const m = path.basename(file).match(/^form_([a-z])\.json$/);
  if (!m) return err(R, "파일명은 form_x.json");
  const L = m[1];
  if (!checkKeys(R, data, ["id", "name", "name_ko", "sections"], [])) return;
  if (data.id !== `form_${L}`) err(R, `id는 form_${L}`);
  if (!Array.isArray(data.sections) || data.sections.length !== ENUMS.mockSections.length) return err(R, `sections ${ENUMS.mockSections.length}개 필요`);
  ENUMS.mockSections.forEach((spec, si) => {
    const s = data.sections[si]; const sl = `${R}:sections[${si}]`;
    if (!checkKeys(sl, s, ["code", "secs", "items"], [])) return;
    if (s.code !== spec.code) err(sl, `code는 ${spec.code}`);
    if (s.secs !== spec.secs) err(sl, `secs는 ${spec.secs}`);
    if (!Array.isArray(s.items)) return err(sl, "items 배열");
    if (s.items.length !== spec.count) (STRICT ? err : warn)(sl, `문항 수 ${s.items.length} (필요 ${spec.count})`);
    const prefix = ENUMS.subtests[spec.code].prefix;
    const idRe = new RegExp(`^f${L}_${prefix}_(\\d{2})$`);
    s.items.forEach((it, i) => {
      const loc = `${sl}#${i}${it && it.id ? `(${it.id})` : ""}`;
      checkItem(spec.code, it, loc);
      const mm = it && typeof it.id === "string" && it.id.match(idRe);
      if (!mm) err(loc, `id 형식 f${L}_${prefix}_00`);
      else if (Number(mm[1]) !== i + 1) err(loc, `id 번호는 ${String(i + 1).padStart(2, "0")}`);
      trackId(it && it.id, loc);
      if (it) trackStem(spec.code, it, loc);
    });
    checkDistribution(spec.code, s.items, sl);
  });
}

function validateTopics(file, sub) {
  const data = readJSON(file); if (data === undefined) return;
  const R = rel(file);
  if (!Array.isArray(data)) return err(R, "JSON 배열이어야 함");
  const keys = data.map(t => t && t.key);
  const want = sub === "RCT" ? ENUMS.rctQtypes : TOPIC_KEYS[sub];   // RCT 노트는 문제 유형(qtype)별
  if (JSON.stringify(keys) !== JSON.stringify(want)) err(R, `키가 ${sub === "RCT" ? "rctQtypes" : `enums.json(${sub}) 토픽`}과 같은 순서로 모두 있어야 함: ${want.join(", ")}`);
  data.forEach((t, i) => {
    const loc = `${R}#${i}(${t && t.key})`;
    if (!checkKeys(loc, t, ["key", "ko", "pts", "steps", "trap"], ["example"])) return;
    if (!Array.isArray(t.pts) || t.pts.length < 2 || t.pts.length > 6 || !t.pts.every(p => isStr(p) && HANGUL.test(p))) err(loc, "pts 2–6개 한국어");
    if (!isStr(t.steps) || !HANGUL.test(t.steps)) err(loc, "steps 한국어");
    if (!isStr(t.trap) || !HANGUL.test(t.trap)) err(loc, "trap 한국어");
    if (t.example != null) {
      const e = t.example;
      if (!e || !isStr(e.q) || !isStr(e.a) || !isStr(e.explain)) err(loc, "example은 {q,a,explain}");
      else for (const k of Object.keys(e)) if (!["q", "a", "explain"].includes(k)) err(loc, `example 알 수 없는 필드 ${k}`);
    }
  });
}

const GUIDE_KEYS = ["overview", "mst", "rct", "mct", "anit", "pbm", "natfi", "birv", "scoring", "retake"];
function validateGuides(file) {
  const data = readJSON(file); if (data === undefined) return;
  const R = rel(file);
  if (!data || typeof data !== "object" || Array.isArray(data)) return err(R, "객체여야 함");
  for (const k of GUIDE_KEYS) if (!(k in data)) err(R, `가이드 키 누락: ${k}`);
  for (const [k, g] of Object.entries(data)) {
    const loc = `${R}:${k}`;
    if (!GUIDE_KEYS.includes(k)) err(loc, "알 수 없는 가이드 키");
    if (!checkKeys(loc, g, ["key", "title", "format", "sections"], ["tips", "sources"])) continue;
    if (g.key !== k) err(loc, "key 불일치");
    if (!Array.isArray(g.sections) || !g.sections.length || !g.sections.every(s => s && isStr(s.h) && isStr(s.body))) err(loc, "sections [{h,body}] 필요");
    if (g.tips != null && !(Array.isArray(g.tips) && g.tips.every(isStr))) err(loc, "tips 문자열 배열");
    if (g.sources != null && !(Array.isArray(g.sources) && g.sources.every(isStr))) err(loc, "sources 문자열 배열");
  }
}

/* ---------- dispatch ---------- */
function kindOf(file) {
  const r = rel(file).split(path.sep);
  if (r[0] !== "content") return null;
  if (r[1] === "terms") return { k: "terms" };
  if (r[1] === "mocks") return { k: "mock" };
  if (r[1] === "guides") return { k: "guides" };
  if (r[1] === "topics") { const s = PREFIX2SUB[path.basename(file, ".json")]; return s ? { k: "topics", sub: s } : null; }
  const s = PREFIX2SUB[r[1]]; return s ? { k: "bank", sub: s } : null;
}
function validateFile(file) {
  const kd = kindOf(file);
  if (!kd) return warn(rel(file), "알 수 없는 위치 — 건너뜀");
  if (kd.k === "bank") validateBank(file, kd.sub);
  else if (kd.k === "terms") validateTerms(file);
  else if (kd.k === "mock") validateMock(file);
  else if (kd.k === "topics") validateTopics(file, kd.sub);
  else if (kd.k === "guides") validateGuides(file);
}
function listJSON(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => f.endsWith(".json")).sort().map(f => path.join(dir, f));
}

let targets;
if (files.length) targets = files.map(f => path.resolve(f));
else {
  targets = [];
  for (const s of SUBS) targets.push(...listJSON(path.join(CONTENT, ENUMS.subtests[s].prefix)));
  targets.push(...listJSON(path.join(CONTENT, "terms")), ...listJSON(path.join(CONTENT, "mocks")),
               ...listJSON(path.join(CONTENT, "topics")), ...listJSON(path.join(CONTENT, "guides")));
}
for (const f of targets) {
  if (!fs.existsSync(f)) { err(rel(f), "파일 없음"); continue; }
  validateFile(f);
}

/* ---------- whole-bank distribution (global mode only) ---------- */
if (!files.length) {
  for (const s of SUBS) {
    const all = listJSON(path.join(CONTENT, ENUMS.subtests[s].prefix)).flatMap(f => { try { const d = JSON.parse(fs.readFileSync(f, "utf8")); return Array.isArray(d) ? d : []; } catch { return []; } });
    if (all.length) {
      const miss = TOPIC_KEYS[s].filter(k => !all.some(it => it.topic === k));
      if (miss.length) warn(`${s} 전체`, `한 번도 안 나온 토픽: ${miss.join(", ")}`);
    }
  }
}

for (const w of warns) console.log(w);
for (const e of errors) console.log(e);
console.log(`\n검증 파일 ${targets.length}개 · 문항/용어 id ${seenIds.size}개 · 경고 ${warns.length} · 오류 ${errors.length}`);
if (errors.length) { console.log("FAIL"); process.exit(1); }
console.log("OK");
