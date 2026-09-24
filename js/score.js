/* ============================================================
   ASTB-E Prep — score.js
   정답률 → 비공식 OAR 추정 · 과목 준비도 · 초반 5문제 · Go/No-Go
   ⚠️ 모든 수치는 학습 동기부여용 비공식 추정이다 (OAR_NOTE).
   ============================================================ */
"use strict";

const TARGET_OAR = 50;            // 사용자 목표 (볼트 노트: OAR 50+)
const TARGET_COMPOSITE = 7;       // AQR·PFAR·FOFAR 목표 (ISEL 7/7/7)
// 평균 정답률 → OAR(20–80). 대다수 응시자가 40–60에 분포한다는 공개 분포를 참고한 단순 구간 선형.
const OAR_CURVE = [[0,20],[.35,26],[.5,38],[.6,46],[.7,53],[.8,61],[.9,70],[.97,77],[1,80]];
const POOL_TARGET = {MST:120, RCT:60, MCT:120, ANIT:150};
const MOCK_KEYS = new Set(["oar","full","form_a","form_b","form_c","pick"]);

function interpCurve(curve,x){ x=clamp(x,0,1);
  for(let i=1;i<curve.length;i++){ const [x0,y0]=curve[i-1],[x1,y1]=curve[i]; if(x<=x1) return y0+(y1-y0)*(x-x0)/(x1-x0); }
  return curve[curve.length-1][1]; }
function oarFromAcc(accs){ if(OAR_SUBS.some(s=>accs[s]==null)) return null;
  return Math.round(interpCurve(OAR_CURVE, OAR_SUBS.reduce((t,s)=>t+accs[s],0)/OAR_SUBS.length)); }
function realExams(){ return (state.examHist||[]).filter(h=>h && !h.learn && !h.practice && h.bySec); }
// 과목 정답률: 최근 실전 3회(그 과목 5문항 이상 — 진단 미니의 RCT 7문항 포함) 우선, 없으면 누적 정답률(8문항 이상)
function subtestAcc(sub){
  const rec=realExams().filter(h=>h.bySec[sub] && h.bySec[sub].total>=5).slice(-3);
  if(rec.length){ const g=rec.reduce((t,h)=>t+h.bySec[sub].got,0), n=rec.reduce((t,h)=>t+h.bySec[sub].total,0); return {acc:g/n, n, src:"exam"}; }
  const o=state.secAcc[sub]; if(o && (o.c+o.w)>=8) return {acc:o.c/(o.c+o.w), n:o.c+o.w, src:"all"};
  return null; }
function estOAR(){ const accs={}, missing=[];
  for(const s of OAR_SUBS){ const a=subtestAcc(s); if(a) accs[s]=a.acc; else missing.push(s); }
  return {oar: missing.length?null:oarFromAcc(accs), accs, missing}; }
function examOAR(h){ if(!h||!h.bySec) return null; const accs={};
  for(const s of OAR_SUBS){ const b=h.bySec[s]; if(!b||b.total<5) return null; accs[s]=b.got/b.total; }
  return oarFromAcc(accs); }
function coverage(sub){ const seen=Object.keys(state.qSeen[sub]||{}).length, pool=Math.max(1,(POOL[sub]||[]).length);
  return Math.min(1, seen/Math.min(POOL_TARGET[sub], pool)); }
function readiness(sub){ const a=subtestAcc(sub); if(!a) return null; return Math.round(100*(0.7*a.acc+0.3*coverage(sub))); }
function first5Acc(sub){ const o=state.first5[sub]; return o&&o.n?o.c/o.n:null; }
function accPctText(sub){ const a=subtestAcc(sub); return a?`${Math.round(a.acc*100)}%`:"–"; }

/* ---------- Go / No-Go (볼트 노트 '05 ASTB-E 공부법' §4) ---------- */
function goNoGo(){
  const rows=[];
  // 1) MST·MCT·ANIT 정답률 80%+ (각 20문항 이상 표본)
  const three=["MST","MCT","ANIT"].map(s=>({s,a:subtestAcc(s)}));
  rows.push({ok: three.every(x=>x.a && x.a.n>=20 && x.a.acc>=0.8), label:"MST·MCT·ANIT 정답률 80%+",
    sub: three.map(x=>`${x.s} ${x.a?Math.round(x.a.acc*100)+"%":"–"}`).join(" · ")});
  // 2) 서로 다른 모의고사 2회 연속 목표권 (예상 OAR 50+)
  const mocks=realExams().filter(h=>MOCK_KEYS.has(h.key) && examOAR(h)!=null).slice(-2);
  const two=mocks.length===2 && mocks.every(h=>examOAR(h)>=TARGET_OAR) && (mocks[0].key!==mocks[1].key || !/^form_/.test(mocks[0].key));
  rows.push({ok:two, label:`서로 다른 모의고사 2회 연속 목표권 (OAR ${TARGET_OAR}+)`,
    sub: mocks.length ? mocks.map(h=>`${fmtDate(h.date)} ${examOAR(h)}`).join(" → ") : "모의고사 기록 없음"});
  // 3) PBM 10세션
  const pbm=(state.pbmLog||[]).filter(x=>!x.del).length;
  rows.push({ok:pbm>=10, label:"PBM 연습 10세션 이상 (조이스틱+스로틀)", sub:`${pbm} / 10 세션 · 통계 탭에서 기록`});
  // 4) 최근 2주 '원리 모름' 0건 (충분한 풀이량이 있을 때만 인정)
  const since=addDays(todayStr(),-13);
  const r1=(state.reasonLog||[]).filter(x=>x.r===1 && x.d>=since).length;
  let solved=0; for(let i=0;i<14;i++){ const d=state.daily[addDays(todayStr(),-i)]; solved+=d?(d.studied||0):0; }
  rows.push({ok: r1===0 && solved>=60, label:"최근 2주 '① 원리 모름' 0건",
    sub: solved<60 ? `최근 2주 풀이 ${solved}문제 — 60문제 이상 풀어야 판정` : `원리 모름 ${r1}건 · 풀이 ${solved}문제`});
  const n=rows.filter(r=>r.ok).length;
  return {rows, n, go:n===rows.length};
}
