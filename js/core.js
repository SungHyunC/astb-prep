/* ============================================================
   ASTB-E Prep — core.js
   상수 · 헬퍼 · 상태(localStorage) · 일자/스트릭 · 오답노트 · 용어 SM-2
   (헬퍼·저장·SM-2·스트릭은 AFOQT Master app.js에서 이식)
   규칙: 이 파일은 선언만 한다. 실행은 boot.js에서.
   ============================================================ */
"use strict";

const VERSION = "1.0.0";
const CFG = window.ASTB_CONFIG || {};
// 같은 origin(sunghyunc.github.io)을 AFOQT 앱과 공유하므로 모든 키는 astb_ 접두사.
const LS = { state:"astb_state_v1", code:"astb_sync_code", device:"astb_device_id", url:"astb_sb_url", key:"astb_sb_key",
  examSave:"astb_exam_save_v1", examDyn:"astb_exam_save_v1_d", nav:"astb_nav_collapsed" };

const SUBS = ["MST","RCT","MCT","ANIT"];
const OAR_SUBS = ["MST","RCT","MCT"];
// 실전 문항수·시간은 공개 자료 기준 추정치 (공식 NAMI 가이드로 재확인 필요)
const SUBMETA = {
  MST:  {ko:"수학",     en:"Math Skills Test",                icon:"🔢", n:30, secs:2400, desc:"산술·대수·기하·문장제", spec:"약 30문항 · 40분 · 적응형 · 계산기 불가"},
  RCT:  {ko:"독해",     en:"Reading Comprehension Test",      icon:"📖", n:20, secs:1800, desc:"짧은 지문 → 지문이 뒷받침하는 진술", spec:"약 20문항 · 30분 · 적응형 · 어휘·유추 없음"},
  MCT:  {ko:"기계",     en:"Mechanical Comprehension Test",   icon:"⚙️", n:30, secs:900,  desc:"지렛대·도르래·기어·유체·전기", spec:"약 30문항 · 15분 · 적응형 · 그림 문제 多"},
  ANIT: {ko:"항공·해상", en:"Aviation & Nautical Information", icon:"✈️", n:30, secs:900,  desc:"항공 지식 + 해군 용어·함정·항모", spec:"약 30문항 · 15분 · 암기형 (공부 효과 최대)"},
};
const SECRATE = {MST:80, RCT:90, MCT:30, ANIT:30};         // 실전 배분 초/문항
const REASONS = {1:"원리 모름", 2:"적용 실수", 3:"계산 실수", 4:"시간 부족"};
const REASON_FIX = {1:"유형 노트로 원리부터", 2:"같은 유형 드릴 반복", 3:"같은 유형 드릴 + 검산 습관", 4:"시간 제한 SET으로 속도 훈련"};
const OAR_NOTE = "※ 비공식 추정 — 실제 ASTB-E 환산·척도와 다를 수 있어요.";
const DAILY_MIN = 20;                                      // 이만큼 풀면 '학습한 날'
const OPT_LETTERS = ["A","B","C","D","E"];

/* ---------- helpers ---------- */
const $  = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];
const clamp = (v,a,b) => Math.max(a, Math.min(b, v));
const nowISO = () => new Date().toISOString();
const todayStr = (d=new Date()) => { const z=new Date(d.getTime()-d.getTimezoneOffset()*60000); return z.toISOString().slice(0,10); };
const parseDate = s => { const [y,m,d]=String(s).split("-").map(Number); return new Date(y,m-1,d); };
const dayDiff = (a,b) => Math.round((parseDate(b)-parseDate(a))/86400000);
const addDays = (s,n) => { const d=parseDate(s); d.setDate(d.getDate()+n); return todayStr(d); };
const shuffle = a => { a=[...a]; for(let i=a.length-1;i>0;i--){const j=(Math.random()*(i+1))|0;[a[i],a[j]]=[a[j],a[i]];} return a; };
const sample = (arr,n) => shuffle(arr).slice(0,n);
const esc = s => String(s==null?"":s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const pctOf = (a,b) => b ? Math.round(a/b*100) : 0;
const fmtDate = s => { if(!s) return ""; const d=parseDate(s); return `${d.getMonth()+1}/${d.getDate()}`; };
function fmtTime(s){ s=Math.max(0,s|0); return Math.floor(s/60)+":"+String(s%60).padStart(2,"0"); }
// 가벼운 인라인 수식 렌더러 (AFOQT 앱과 동일): ^지수, _아래첨자, sqrt(, pi, *, <= >= !=
function fmtMath(s){
  return esc(s)
    .replace(/\bsqrt\s*\(/gi,'√(')
    .replace(/\^\{([^}]+)\}/g,(m,g)=>`<sup>${g}</sup>`)
    .replace(/\^\(([^)]+)\)/g,(m,g)=>`<sup>(${g})</sup>`)
    .replace(/\^(-?\d+(?:\.\d+)?|[A-Za-z])/g,(m,g)=>`<sup>${g}</sup>`)
    .replace(/_\{([^}]+)\}/g,(m,g)=>`<sub>${g}</sub>`)
    .replace(/_(\d+|[A-Za-z])\b/g,(m,g)=>`<sub>${g}</sub>`)
    .replace(/\bpi\b/g,'π')
    .replace(/\s*\*\s*/g,' × ')
    .replace(/&lt;=/g,'≤').replace(/&gt;=/g,'≥').replace(/!=/g,'≠');
}
function toast(msg, ms=1800){ const t=$("#toast"); if(!t) return; t.textContent=msg; t.classList.add("show");
  clearTimeout(toast._t); toast._t=setTimeout(()=>t.classList.remove("show"), ms); }
// 결정적 셔플(고정 SET 구성용): 문자열 → 시드 → mulberry32
function hashStr(s){ let h=2166136261>>>0; for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); } return h>>>0; }
function seededShuffle(arr, seedStr){ let a=hashStr(seedStr)||1; const rnd=()=>{ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a);
    t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; };
  const out=[...arr]; for(let i=out.length-1;i>0;i--){ const j=(rnd()*(i+1))|0; [out[i],out[j]]=[out[j],out[i]]; } return out; }

/* ---------- state ---------- */
let state = null;
let suppressPersistence = false;   // 초기화·복원 직후 새로고침 전까지 저장 금지
function DEFAULT_STATE(){ return {
  v:1,
  daily:{},            // day -> {studied, correct, seconds, goal_met, updated_at}
  dayStats:{},         // day -> {MST:n, RCT:n, MCT:n, ANIT:n, terms:n, termsNew:n, review:n, mock:n}
  exams:{},            // presetKey -> {best,bestTotal,last,lastTotal,date,updated_at}
  examHist:[],         // 시험 기록 (최근 200, 상세 items는 최근 10회만)
  wrongs:{},           // qid -> {s,n,reason,next,streak,first,last,cleared,u}
  reasonLog:[],        // [{id,s,r,d}] 틀린 이유 기록 (Go/No-Go '최근 2주 원리 모름')
  weak:{topic:{}},     // "MST:unit_conversion" -> {c,w}
  secAcc:{},           // MST -> {c,w} 누적
  qSeen:{MST:{},RCT:{},MCT:{},ANIT:{}},   // qid -> 마지막 풀이 시각
  speed:{},            // MST -> {n,ms,slow}
  first5:{},           // MST -> {c,n}  실전 섹션 첫 5문항 정답
  terms:{},            // termId -> SM-2 카드
  pbmLog:[],           // [{id,date,min,rate,miss,memo,del?}]
  realScores:[],       // [{id,date,oar,aqr,pfar,fofar,memo,del?}]
  checklist:{},        // day -> {taskId:1}
  settings:{ exam_date:"", phase:0, p2start:"", hide_ko:false, no_back:true, terms_per_day:20, onboard_done:0 },
}; }
function loadLocal(){
  try{ state=JSON.parse(localStorage.getItem(LS.state))||DEFAULT_STATE(); }catch{ state=DEFAULT_STATE(); }
  const d=DEFAULT_STATE();
  for(const k of Object.keys(d)) if(state[k]==null) state[k]=d[k];
  state.settings=Object.assign(d.settings, state.settings||{});
  state.qSeen=Object.assign({MST:{},RCT:{},MCT:{},ANIT:{}}, state.qSeen||{});
  state.weak=Object.assign({topic:{}}, state.weak||{});
  // 오래된 일별 카운트 정리(120일)
  const cut=addDays(todayStr(),-120);
  for(const k of Object.keys(state.dayStats)) if(k<cut) delete state.dayStats[k];
  for(const k of Object.keys(state.checklist)) if(k<cut) delete state.checklist[k];
  if(state.reasonLog.length>600) state.reasonLog=state.reasonLog.slice(-600);
}
let saveTimer=null, localSaveWarned=false;
function persistBlocked(){ return suppressPersistence || (typeof syncCodeChangedElsewhere==="function" && syncCodeChangedElsewhere()); }
// syncMisc=false: 원격 병합 결과처럼 서버로 다시 올릴 필요 없는 로컬 저장
function saveLocal(syncMisc=true){ if(persistBlocked()) return;
  clearTimeout(saveTimer); saveTimer=setTimeout(saveNow,150);
  if(syncMisc && typeof queuePush==="function") queuePush("app_state"); }
// 모바일은 백그라운드에서 타이머가 멈춘다 — 숨김/pagehide에서 반드시 즉시 저장
function saveNow(){ clearTimeout(saveTimer); if(persistBlocked()) return;
  try{ localStorage.setItem(LS.state, JSON.stringify(state)); }
  catch(e){ console.error("local save failed",e); if(!localSaveWarned){ localSaveWarned=true;
    setTimeout(()=>toast("⚠️ 저장 공간이 부족해요. 진도 백업 후 브라우저 저장 공간을 확인해 주세요.",5000),0); } } }
function flag(k){ return !!state.settings[k]; }

/* ---------- daily / streak ---------- */
function getDay(day=todayStr()){ if(!state.daily[day]) state.daily[day]={studied:0,correct:0,seconds:0,goal_met:false}; return state.daily[day]; }
function bumpDay(f){ const day=todayStr(), d=getDay(day);
  for(const k in f) d[k]=(d[k]||0)+f[k];
  d.goal_met = d.studied>=DAILY_MIN || (typeof planAllDone==="function" && planAllDone());
  d.updated_at=nowISO(); saveLocal();
  if(typeof queuePush==="function") queuePush("daily_log",{day,...d}); }
function statBump(key,n=1){ const day=todayStr(), ds=state.dayStats[day]||(state.dayStats[day]={}); ds[key]=(ds[key]||0)+n; }
function todayStat(key){ const ds=state.dayStats[todayStr()]||{}; return ds[key]||0; }
function dayActive(key){ const r=state.daily[key]; return !!(r && (r.goal_met || (r.studied||0)>=10)); }
// 스트릭 보호막: 7일 구간마다 하루 빠짐은 1번 봐준다(AFOQT 앱과 동일).
function computeStreak(){ let s=0, weekSkips=0; const cur=parseDate(todayStr());
  for(let i=0;i<4000;i++){ if(i>0 && i%7===0) weekSkips=0;
    const d=new Date(cur); d.setDate(d.getDate()-i); const key=todayStr(d);
    if(dayActive(key)){ s++; continue; }
    if(i===0) continue;
    if(weekSkips<1){ weekSkips++; continue; }
    break; }
  return s; }

/* ---------- 오답노트 (틀린 이유 4분류 + 다시 볼 날) ----------
   첫 오답: 3일 뒤 다시 보기. 다시 틀리면 1일 뒤. 연속 2번 맞히면 졸업(cleared).
   cleared는 지우지 않고 표시만 해 두어(툼스톤) 다른 기기와 병합할 때 되살아나지 않게 한다. */
const wrongActive = w => !!(w && !w.cleared);
function noteAnswer(it, ok){
  const id=it&&it.qid; if(!id) return;
  const t=todayStr(), w=state.wrongs[id], now=Date.now();
  if(ok){
    if(wrongActive(w)){ w.streak=(w.streak||0)+1; w.u=now;
      if(w.streak>=2){ w.cleared=1; w.clearedOn=t; } else w.next=addDays(t,3); }
    return;
  }
  if(wrongActive(w)){ w.n=(w.n||1)+1; w.streak=0; w.next=addDays(t,1); w.last=t; w.u=now; }
  else state.wrongs[id]={s:it.section, n:((w&&w.n)||0)+1, reason:null, next:addDays(t,3), streak:0, first:t, last:t, cleared:0, u:now};
}
function setReason(id, r){
  const w=state.wrongs[id]; if(!w) return;
  w.reason = (w.reason===r) ? null : r; w.u=Date.now();
  const t=todayStr(), i=state.reasonLog.findIndex(x=>x.id===id && x.d===t);
  if(w.reason){ const e={id,s:w.s,r:w.reason,d:t}; if(i>=0) state.reasonLog[i]=e; else state.reasonLog.push(e); }
  else if(i>=0) state.reasonLog.splice(i,1);
  if(state.reasonLog.length>600) state.reasonLog=state.reasonLog.slice(-600);
  saveLocal();
}
function activeWrongs(sub){ return Object.entries(state.wrongs)
  .filter(([id,w])=>wrongActive(w) && (!sub || w.s===sub) && (typeof ITEM_INDEX==="undefined" || ITEM_INDEX.has(id))); }
function dueWrongs(sub){ const t=todayStr(); return activeWrongs(sub).filter(([,w])=>!w.next || w.next<=t); }
function reasonHTML(id){
  const w=state.wrongs[id]; if(!w) return "";
  return `<div class="rsn-row" data-rid="${esc(id)}"><span class="lbl">틀린 이유를 골라 두면 약점 분석·Go/No-Go에 반영돼요</span>${
    [1,2,3,4].map(r=>`<button class="rsn r${r} ${w.reason===r?"on":""}" data-r="${r}">${"①②③④"[r-1]} ${REASONS[r]}</button>`).join("")}</div>`;
}
// 문서 어디서든 이유 칩을 누르면 기록 (시험 해설·오답노트·드릴 공통)
document.addEventListener("click", e=>{
  const b=e.target.closest && e.target.closest(".rsn"); if(!b) return;
  const row=b.closest(".rsn-row"); if(!row) return;
  const id=row.dataset.rid, r=+b.dataset.r; setReason(id,r);
  const w=state.wrongs[id];
  $$(".rsn",row).forEach(x=>x.classList.toggle("on", !!w && w.reason===+x.dataset.r));
  if(w && w.reason) toast(`기록: ${REASONS[w.reason]} → ${REASON_FIX[w.reason]}`);
});

/* ---------- ANIT 용어 SM-2 (AFOQT 앱 gradeCard 이식) ---------- */
function getTerm(id){ return state.terms[id] || {status:"new",reps:0,lapses:0,ease:2.5,interval:0,due:null}; }
function setTerm(id,c){ c.updated_at=nowISO(); state.terms[id]=c; saveLocal(); }
function predictTerm(id,q){ const c=getTerm(id);
  if(q==="hard") return c.reps===0?1:Math.max(1,c.interval*1.2);
  if(q==="good") return c.reps===0?1:c.reps===1?3:c.interval*c.ease;
  if(q==="easy") return c.reps===0?2:c.interval*(c.ease+0.15)*1.3; return 0; }
function gradeTerm(id,q){ const c={...getTerm(id)}; const wasNew=c.status==="new";
  if(q==="again"){ c.lapses++; c.ease=Math.max(1.3,c.ease-0.2); c.interval=0; c.reps=0; c.status="learning"; c.due=nowISO(); }
  else { if(q==="hard"){ c.ease=Math.max(1.3,c.ease-0.15); c.interval=c.reps===0?1:Math.max(1,c.interval*1.2); }
    else if(q==="good"){ c.interval=c.reps===0?1:c.reps===1?3:c.interval*c.ease; }
    else { c.ease+=0.15; c.interval=c.reps===0?2:c.interval*c.ease*1.3; }
    c.reps++; c.status=c.interval>=21?"mastered":(c.reps>=2?"review":"learning");
    const due=new Date(); due.setMinutes(due.getMinutes()+Math.round(c.interval*1440)); c.due=due.toISOString(); }
  setTerm(id,c); statBump("terms"); if(wasNew) statBump("termsNew"); }
function fmtIv(d){ if(d<1) return "<1일"; if(d>=21) return "마스터"; return Math.round(d)+"일"; }
function termDue(c,t=Date.now()){ return !!(c && c.status!=="new" && c.due && new Date(c.due).getTime()<=t); }

/* ---------- sheet ---------- */
function openSheet(id){ $("#"+id).classList.add("open"); }
function closeSheet(id){ $("#"+id).classList.remove("open"); }
