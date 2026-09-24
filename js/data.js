/* ============================================================
   ASTB-E Prep — data.js
   data/*.json 로드 · 색인 · 문항 → 시험 아이템 변환 · 출제 헬퍼
   data/는 scripts/build_data.mjs가 content/에서 만든다.
   ============================================================ */
"use strict";

let META = null;                              // enums + counts (data/meta.json)
let POOL = {MST:[], RCT:[], MCT:[], ANIT:[]}; // 문제은행 원본
let TERMS = [];                               // ANIT 용어집
let TOPICNOTES = {};                          // {MST:[{key,ko,pts,steps,trap,example}], RCT:[qtype별]}
let GUIDES = {};
let MOCKS = {};                               // {a:{…}, b:{…}, c:{…}}
let ITEM_INDEX = new Map();                   // qid -> {sub, raw, src}
let TERM_INDEX = new Map();
const SET_SIZE = 20;                          // 과목별 고정 SET 크기
const RCT_QTYPE_KO = {inference:"추론 — 지문이 뒷받침하는 진술", main_idea:"주제·요지", detail:"세부 내용"};
const NAVAL_TOPICS = new Set(["nautical_terms","ship_types","carrier_ops","navy_org_ranks","seamanship"]);

async function loadJSON(path){
  try{ const ctrl=new AbortController(); const t=setTimeout(()=>ctrl.abort(),20000);
    const r=await fetch(path,{cache:"no-cache",signal:ctrl.signal}); clearTimeout(t);
    if(!r.ok) return null; return await r.json(); }
  catch{ return null; }
}
async function loadData(){
  const meta=await loadJSON("./data/meta.json");
  const forms=((meta&&meta.counts&&meta.counts.mocks)||[]).filter(L=>/^[a-z]$/.test(L));   // 빌드된 모의고사만 요청
  const names=["mst","rct","mct","anit","terms","topics","guides",...forms.map(L=>"mock_"+L)];
  const got=await Promise.all(names.map(n=>loadJSON(`./data/${n}.json`)));
  const D=Object.fromEntries(names.map((n,i)=>[n,got[i]])); D.meta=meta;
  META=D.meta||{topics:{MST:[],RCT:[],MCT:[],ANIT:[]},rctQtypes:["inference","main_idea","detail"]};
  POOL={MST:D.mst||[], RCT:D.rct||[], MCT:D.mct||[], ANIT:D.anit||[]};
  TERMS=D.terms||[]; TOPICNOTES=D.topics||{}; GUIDES=D.guides||{};
  MOCKS={}; for(const L of forms){ const m=D["mock_"+L]; if(m&&Array.isArray(m.sections)) MOCKS[L]=m; }
  ITEM_INDEX=new Map(); TERM_INDEX=new Map(TERMS.map(t=>[t.id,t]));
  for(const s of SUBS) for(const q of POOL[s]) ITEM_INDEX.set(q.id,{sub:s,raw:q,src:"bank"});
  for(const L in MOCKS) for(const sec of MOCKS[L].sections) for(const q of (sec.items||[])) ITEM_INDEX.set(q.id,{sub:sec.code,raw:q,src:"form_"+L});
  _setCache={};
  return !!(D.meta);
}

/* ---------- labels ---------- */
function topicsOf(sub){ return (META&&META.topics&&META.topics[sub])||[]; }
function topicKo(sub,key){ const t=topicsOf(sub).find(x=>x.key===key); return t?t.ko:key; }
function weakKey(it){ return it.section==="RCT" ? "RCT:"+(it.qtype||"inference") : it.section+":"+it.topic; }
function weakLabel(k){ const [s,key]=k.split(":"); return s==="RCT" ? (RCT_QTYPE_KO[key]||key) : topicKo(s,key); }
function diffDots(d){ return "●".repeat(d||1)+"○".repeat(3-(d||1)); }

/* ---------- 원본 → 시험 아이템 ---------- */
function toItem(sub, raw, src){
  if(!raw) return null;
  return {section:sub, qid:raw.id, topic:raw.topic, diff:raw.diff, prompt:raw.q, promptKo:raw.q_ko,
    options:raw.options, answer:raw.answer, explain:raw.explain, fig:raw.fig||null,
    title:raw.title||"", passage:raw.passage||"", passageKo:raw.passage_ko||"", qtype:raw.qtype||"", src:src||"bank"};
}
function itemById(id){ const x=ITEM_INDEX.get(id); return x ? toItem(x.sub,x.raw,x.src) : null; }

/* ---------- 출제: 덜 본 문항 우선 ---------- */
function pickFresh(sub, n, filter){
  let pool=POOL[sub]; if(filter) pool=pool.filter(filter);
  const seen=state.qSeen[sub]||{};
  const ranked=shuffle(pool).sort((a,b)=>(seen[a.id]||0)-(seen[b.id]||0));
  return shuffle(ranked.slice(0,n)).map(q=>toItem(sub,q,"bank"));
}
// 난이도를 섞되 쉬운 것 → 어려운 것 순에 가깝게 (적응형 실전 초반 적응용)
function orderForExam(items){ return [...items].sort((a,b)=>((a.diff||2)-(b.diff||2))+(Math.random()-.5)*1.6); }

/* ---------- 고정 SET: 은행을 결정적으로 섞어 SET_SIZE씩 ---------- */
let _setCache={};
function bankSets(sub){
  if(_setCache[sub]) return _setCache[sub];
  const ids=POOL[sub].map(q=>q.id).sort();
  const mixed=seededShuffle(ids,"astb-set-v1-"+sub);
  const sets=[]; for(let i=0;i<mixed.length;i+=SET_SIZE) sets.push(mixed.slice(i,i+SET_SIZE));
  if(sets.length>1 && sets[sets.length-1].length<SET_SIZE/2){ const last=sets.pop(); sets[sets.length-1]=sets[sets.length-1].concat(last); }
  return (_setCache[sub]=sets);
}
