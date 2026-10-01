/* ============================================================
   ASTB-E Prep — cat.js
   컴퓨터 적응형 시험(CAT) 엔진 — 실제 ASTB-E(MST·RCT·MCT·ANIT)처럼
   · 맞히면 더 어려운 문항, 틀리면 더 쉬운 문항이 나온다
   · 건너뛰기·되돌아가기·답 바꾸기 불가, 시간 안에 못 푼 문항은 감점
   · 점수 = 정답 개수가 아니라 '추정 능력(θ)' — 어느 난이도까지 올라갔는가
   모형: 3모수 로지스틱(3PL). b는 문항 diff(1–4)로 정한 근사값, a·c는 고정.
   추정: EAP(사전분포 N(0,1)). 선택: 정보량 최대 + 토픽 균형 + 노출 제어 + 덜 본 문항 우선.
   ⚠️ 문항 모수는 실측 보정값이 아니라 작성 난이도 기반 → 점수는 비공식 추정(OAR_NOTE).
   ============================================================ */
"use strict";

const CAT = {
  D:1.7, A:1.0, C:0.2,                         // 척도 상수 · 변별도 · 추측도(4지선다)
  B:{1:-1.0, 2:0.0, 3:1.0, 4:1.8},             // diff → 난이도 b
  // 실전 섹션(공개 자료 기준 추정, 공식 가이드로 재확인): 문항 수 · 제한 시간(초)
  SPEC:{MST:{n:30,secs:2400}, RCT:{n:20,secs:1800}, MCT:{n:30,secs:900}, ANIT:{n:30,secs:900}},
  REF_MIX:{1:0.3, 2:0.5, 3:0.2},               // 환산 기준 '표준 시험지' 난이도 구성 (OAR_CURVE가 가정한 구성)
};
const CAT_LV_KO = {1:"쉬움", 2:"보통", 3:"어려움", 4:"최상"};
const CAT_GRID = []; for(let i=0;i<=160;i++) CAT_GRID.push(-4+i*0.05);
const CAT_PRIOR = CAT_GRID.map(t=>Math.exp(-t*t/2));

function catP(th,b){ return CAT.C+(1-CAT.C)/(1+Math.exp(-CAT.D*CAT.A*(th-b))); }
function catInfo(th,b){ const p=catP(th,b), k=CAT.D*CAT.A; return k*k*Math.pow((p-CAT.C)/(1-CAT.C),2)*(1-p)/p; }
function catLevel(it){ return clamp(Math.round((it&&it.diff)||2),1,4); }
function catB(it){ return CAT.B[catLevel(it)]; }
// resp: [{b,u}] — u: 1 정답 · 0 오답 · 0.25 미응답(무작위로 찍었을 때의 기대값만큼 감점)
function catEstimate(resp){
  const post=CAT_PRIOR.slice();
  for(const r of resp){ let s=0;
    for(let i=0;i<post.length;i++){ const p=catP(CAT_GRID[i],r.b); post[i]*=Math.pow(p,r.u)*Math.pow(1-p,1-r.u); s+=post[i]; }
    if(s>0) for(let i=0;i<post.length;i++) post[i]/=s; }
  let s=0, m=0; for(let i=0;i<post.length;i++){ s+=post[i]; m+=CAT_GRID[i]*post[i]; } m/=s||1;
  let v=0; for(let i=0;i<post.length;i++) v+=(CAT_GRID[i]-m)*(CAT_GRID[i]-m)*post[i]; v/=s||1;
  return {theta:m, se:Math.sqrt(v)};
}
// θ → '표준 시험지'(쉬움30·보통50·어려움20)에서의 기대 정답률 → OAR 척도(20–80) 환산.
// 고정 문항 모의고사의 정답률 → OAR 추정(score.js)과 같은 척도라서 둘을 비교할 수 있다.
function catRefAcc(th){ let a=0; for(const L in CAT.REF_MIX) a+=CAT.REF_MIX[L]*catP(th,CAT.B[L]); return a; }
function catScaled(th){ return Math.round(interpCurve(OAR_CURVE,catRefAcc(th))); }
function normCdf(z){ const t=1/(1+0.2316419*Math.abs(z)), d=0.3989423*Math.exp(-z*z/2);
  const p=d*t*(0.3193815+t*(-0.3565638+t*(1.781478+t*(-1.821256+t*1.330274)))); return z>0?1-p:p; }
// 환산 점수를 평균 50·표준편차 10 척도로 보고 '상위 몇 %'로 (비공식)
function catTopPct(sc){ return clamp(Math.round(100*(1-normCdf((sc-50)/10))),1,99); }
const fmtTh = v => (v>=0?"+":"−")+Math.abs(v).toFixed(1);

/* ---------- 문항 선택 ---------- */
let _catShare={};
function catTopicShare(sub){ if(_catShare[sub]) return _catShare[sub];
  const c={}, pool=POOL[sub]||[]; for(const q of pool) c[q.topic]=(c[q.topic]||0)+1;
  for(const k in c) c[k]/=pool.length||1; return (_catShare[sub]=c); }
function catPick(sub, theta, usedIds, secItems){
  const pool=POOL[sub]||[]; if(!pool.length) return null;
  const used=new Set(usedIds), seen=(state.qSeen&&state.qSeen[sub])||{}, now=Date.now(), share=catTopicShare(sub);
  const info={}; let maxI=0; for(const L of [1,2,3,4]){ info[L]=catInfo(theta,CAT.B[L]); maxI=Math.max(maxI,info[L]); }
  const cnt={}; for(const it of secItems) cnt[it.topic]=(cnt[it.topic]||0)+1;
  const n=secItems.length, lastTopic=n?secItems[n-1].topic:null, cands=[];
  for(const q of pool){ if(used.has(q.id)) continue;
    let s=info[catLevel(q)]/maxI;                                   // 1 = 지금 실력에 가장 알맞은 난이도
    const over=(cnt[q.topic]||0)-(share[q.topic]||0)*(n+1);           // 토픽 균형(출제 범위 고르게)
    s*= over>0.5?0.4 : over>-0.5?0.85 : 1;
    if(q.topic===lastTopic) s*=0.6;                                   // 같은 유형 연속 방지
    const last=seen[q.id]; if(last){ const days=(now-last)/86400000; s*= days<3?0.2 : days<14?0.4 : 0.7; }   // 덜 본 문항 우선
    s*=0.9+Math.random()*0.2;                                         // 노출 제어용 흔들림
    cands.push([s,q]); }
  if(!cands.length) return null;
  cands.sort((a,b)=>b[0]-a[0]);
  const top=cands.slice(0,3); return top[(Math.random()*top.length)|0][1];   // 상위 3개 중 무작위(randomesque)
}

/* ---------- 시험 진행 (exam.js의 러너에 cat 플래그로 붙는다) ---------- */
// cfg: {key,name,kind,codes:[...],catN:{MST:10…}(선택),practice,from}
function launchCat(cfg){
  const mult=cfg.practice?2.2:1;
  const secs=(cfg.codes||[]).filter(c=>(POOL[c]||[]).length).map(code=>{
    const custom=cfg.catN&&cfg.catN[code], n=custom||CAT.SPEC[code].n;
    const t=Math.round((custom?n*(SECRATE[code]||30):CAT.SPEC[code].secs)*mult);
    return {code,n,secs:t,left:t,from:null,to:null,done:false}; });
  if(!secs.length){ toast("문제 데이터가 아직 없어요. 잠시 후 다시 시도해 주세요."); return; }
  if(!confirmDropExamSnap()) return;
  exam={key:cfg.key||null, name:cfg.name||"적응형 모의고사", kind:cfg.kind||"mock", cat:true, paused:true,
    items:[], idx:0, total:secs.reduce((t,s)=>t+s.n,0), answers:[], locked:[], recorded:[], times:[],
    secsLeft:0, startSecs:secs.reduce((t,s)=>t+s.secs,0), submitted:false, timerId:null,
    learn:false, practice:!!cfg.practice, noBack:true, from:cfg.from||curView||"mock", sections:secs, secIdx:0};
  showExamRun(); startExamTimer(); renderExamQ();
}
function catSecRange(s){ const r=[]; if(s&&s.from!=null) for(let i=s.from;i<=s.to;i++) r.push(i); return r; }
function catSecResp(e,s){ return catSecRange(s).filter(i=>e.locked[i]&&e.answers[i]!=null)
  .map(i=>({b:catB(e.items[i]), u:e.answers[i]===e.items[i].answer?1:0})); }
// 현재 섹션의 다음 문항을 골라 붙인다. 문제은행이 바닥나면 false.
function catNextItem(e){
  const s=curExamSec(); if(!s) return false;
  const th=catEstimate(catSecResp(e,s)).theta;
  const q=catPick(s.code, th, e.items.map(it=>it.qid), catSecRange(s).map(i=>e.items[i]));
  if(!q) return false;
  const i=e.items.length;
  e.items.push(toItem(s.code,q,"bank")); e.answers.push(null); e.locked.push(false); e.recorded.push(false); e.times.push(0);
  if(s.from==null) s.from=i; s.to=i; e.idx=i; return true;
}
// 섹션 안내 화면의 '시작' → 시계를 켜고 첫 문항
function catBeginSection(){
  const e=exam; if(!e||!e.cat||!e.paused||e.submitted) return;
  const s=curExamSec(); if(!s) return;
  if(s.from==null&&!catNextItem(e)){ toast("이 과목 문항이 부족해요."); advanceExamSection(true); return; }
  e.paused=false; e._timerAt=Date.now(); e._openIdx=null; e._openAt=null;
  saveExamStatic(); saveExamSnap(); window.scrollTo(0,0); renderExamQ();
}
// '확인' — 답을 확정하고 다음 문항(또는 섹션 종료)
function catConfirm(){
  const e=exam, s=curExamSec(); if(!e||!s) return;
  if(e.answers[e.idx]==null){ toast("답을 골라야 넘어가요 (적응형 실전은 건너뛰기 불가)"); return; }
  e.locked[e.idx]=true;
  const answered=catSecRange(s).filter(i=>e.locked[i]).length;
  if(answered>=s.n){ advanceExamSection(false); return; }
  if(!catNextItem(e)){ s.n=answered; advanceExamSection(false); return; }   // 문제은행이 바닥나면 감점 없이 종료
  saveExamStatic(); saveExamSnap(); window.scrollTo(0,0); renderExamQ();
}
function catSecAnswered(e,s){ return catSecRange(s).filter(i=>e.locked[i]&&e.answers[i]!=null).length; }

/* ---------- 섹션 안내 화면 (실전 APEX처럼 과목마다 규칙 안내 → 시작) ---------- */
const CAT_SEC_NOTE = {
  MST:"계산기 없음 · 연습지(종이)는 사용 가능. 문항당 평균 약 80초.",
  RCT:"지문 1개에 질문 1개. '지문만으로' 뒷받침되는 답을 고르세요. 문항당 평균 약 90초.",
  MCT:"그림 문항이 많아요. 문항당 평균 약 30초 — 원리를 바로 알아보는 속도가 핵심.",
  ANIT:"항공·해상 지식. 문항당 평균 약 30초 — 아는 건 바로, 모르는 건 오래 붙잡지 않기.",
};
function catIntroHTML(e){
  const s=curExamSec(), m=SUBMETA[s.code], k=e.secIdx+1, N=e.sections.length;
  return `<div class="card cat-intro">
    <div class="ci-step">${N>1?`섹션 ${k} / ${N}`:"과목 실전"}${e.practice?" · 연습 모드(시간 2.2배)":""}</div>
    <h2>${m.icon} ${esc(m.ko)} <span class="muted" style="font-size:14px">${esc(m.en)} (${s.code})</span></h2>
    <div class="ci-meta"><b>${s.n}문항</b> · <b>${fmtTime(s.secs)}</b> · 컴퓨터 적응형(CAT)</div>
    <ul class="ci-rules">
      <li>문제는 한 번에 하나씩 나와요. 답을 고르고 <b>확인</b>을 눌러야 다음 문제로 넘어가요.</li>
      <li><b>건너뛰기 · 이전 문제로 돌아가기 · 답 바꾸기가 불가능</b>해요.</li>
      <li>맞히면 더 어려운 문제, 틀리면 더 쉬운 문제가 나와요. 점수는 정답 개수가 아니라 <b>어느 난이도까지 올라갔는지</b>로 정해져요.</li>
      <li>시간이 끝날 때 못 푼 문항은 <b>감점</b>돼요(남은 문항이 많을수록 큼). 마지막에 마구 찍는 것도 권장되지 않아요 — 처음부터 페이스를 지키세요.</li>
      <li>${esc(CAT_SEC_NOTE[s.code]||"")}</li>
    </ul>
    <button class="btn primary" id="catStart">시작 ▶ <span style="font-weight:500;opacity:.85">(시계가 켜져요)</span></button>
    <div class="muted" style="font-size:11.5px;margin-top:8px;text-align:center">안내 화면에서는 시간이 흐르지 않아요 · Enter로 시작</div></div>`;
}

function renderCatIntro(){
  const e=exam, s=curExamSec(); if(!e||!s) return;
  $("#examCount").textContent=`${s.code} · 시작 전`; $("#examBar").style.width="0%";
  $("#examArea").innerHTML=catIntroHTML(e);
  $("#catStart").onclick=catBeginSection;
  $(".exam-nav").classList.add("hidden"); $("#examGrid").classList.add("hidden"); $("#kbdArrows").classList.add("hidden");
  updateTimerUI();
}

/* ---------- 채점 ---------- */
// 섹션별: 확정된 응답으로 θ, 미응답은 감점(정답 확률 1/4로 가중한 우도)
function catScoreSection(e,s){
  const idxs=catSecRange(s), ans=idxs.filter(i=>e.locked[i]&&e.answers[i]!=null);
  const run=[], path=[];
  for(const i of ans){ const it=e.items[i], ok=e.answers[i]===it.answer?1:0; run.push({b:catB(it),u:ok});
    path.push([catLevel(it), ok, +catEstimate(run).theta.toFixed(2)]); }
  const pen=Math.max(0,s.n-ans.length);
  let est=catEstimate(run); const th0=est.theta;
  if(pen) est=catEstimate(run.concat(Array.from({length:pen},()=>({b:th0,u:0.25}))));
  const acc=catRefAcc(est.theta), sc=Math.round(interpCurve(OAR_CURVE,acc));
  return {th:+est.theta.toFixed(2), se:+est.se.toFixed(2), n:ans.length, N:s.n, pen, acc:+acc.toFixed(3), sc,
    got:run.filter(r=>r.u===1).length, top:path.reduce((m,p)=>p[1]?Math.max(m,p[0]):m,0), path};
}

/* ---------- 결과: 적응형 경로 차트 (θ 추정 + 문항 난이도·정오) ---------- */
const CAT_YLO=-2.2, CAT_YHI=2.6;
function catPathSVG(c, code){
  const W=340, H=178, L=50, R=16, T=10, B=24, pw=W-L-R, ph=H-T-B;
  const n=c.path.length, slots=Math.max(c.N||n, n+(c.pen||0), 1);
  const X=i=>L+(i-0.5)*pw/slots, Y=v=>T+(CAT_YHI-clamp(v,CAT_YLO,CAT_YHI))/(CAT_YHI-CAT_YLO)*ph;
  let g="";
  for(const L2 of [1,2,3,4]){ const y=Y(CAT.B[L2]);
    g+=`<line x1="${L}" x2="${W-R}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}" class="cv-grid"/><text x="${L-6}" y="${(y+3.5).toFixed(1)}" text-anchor="end" class="cv-ax">${CAT_LV_KO[L2]}</text>`; }
  g+=`<line x1="${L}" x2="${W-R}" y1="${T+ph}" y2="${T+ph}" class="cv-base"/>`;
  for(let i=1;i<=slots;i++) if(i===1||i%5===0) g+=`<text x="${X(i).toFixed(1)}" y="${H-7}" text-anchor="middle" class="cv-ax">${i}</text>`;
  if(n){ const pts=[[L,Y(0)],...c.path.map((p,i)=>[X(i+1),Y(p[2])])];
    g+=`<polyline points="${pts.map(p=>p[0].toFixed(1)+","+p[1].toFixed(1)).join(" ")}" class="cv-line"/>`; }
  c.path.forEach((p,i)=>{ const x=X(i+1), y=Y(CAT.B[p[0]]);
    g+= p[1] ? `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4.5" class="cv-ok"/>`
      : `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5.5" class="cv-ring"/><path d="M${(x-3.6).toFixed(1)} ${(y-3.6).toFixed(1)} L${(x+3.6).toFixed(1)} ${(y+3.6).toFixed(1)} M${(x+3.6).toFixed(1)} ${(y-3.6).toFixed(1)} L${(x-3.6).toFixed(1)} ${(y+3.6).toFixed(1)}" class="cv-no"/>`; });
  for(let j=1;j<=(c.pen||0);j++) g+=`<circle cx="${X(n+j).toFixed(1)}" cy="${(T+ph-7).toFixed(1)}" r="3.6" class="cv-pen"/>`;
  if(n){ const x=X(n), y=Y(c.path[n-1][2]); g+=`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4.5" class="cv-end"/>`; }
  g+=`<line class="cv-cross" x1="0" x2="0" y1="${T}" y2="${T+ph}" style="display:none"/>`;
  const sum=`${code} 적응형 경로: ${n}문항 응답, 정답 ${c.got}, 최고 정답 난이도 ${CAT_LV_KO[c.top]||"없음"}, 최종 추정 실력 ${fmtTh(c.th)}`;
  return `<svg class="cv-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(sum)}" data-slots="${slots}" data-l="${L}" data-pw="${pw}">${g}</svg>`;
}
function catVizHTML(c, code, title){
  const m=SUBMETA[code]||{ko:code};
  const rows=c.path.map((p,i)=>`<tr><td>${i+1}</td><td>${CAT_LV_KO[p[0]]}</td><td>${p[1]?"✓ 정답":"✕ 오답"}</td><td>${fmtTh(p[2])}</td></tr>`).join("")
    +(c.pen?`<tr><td colspan="4">미응답 ${c.pen}문항 — 감점 반영</td></tr>`:"");
  return `<div class="catviz" data-path='${JSON.stringify(c.path)}' data-code="${esc(code)}">
    <div class="cv-head"><b>${esc(title||`${m.ko} (${code})`)}</b><span>환산 <b>${c.sc}</b> · 상위 약 ${catTopPct(c.sc)}%</span></div>
    <div class="cv-sub">정답 ${c.got}/${c.n}${c.pen?` · 미응답 ${c.pen}(감점)`:""} · 최고로 맞힌 난이도 <b>${CAT_LV_KO[c.top]||"–"}</b> · 추정 실력 ${fmtTh(c.th)} ± ${c.se.toFixed(1)}</div>
    <div class="cv-legend"><span><i class="k-line"></i>추정 실력</span><span><i class="k-ok"></i>맞힌 문항의 난이도</span><span><i class="k-no">✕</i>틀린 문항의 난이도</span>${c.pen?`<span><i class="k-pen"></i>미응답</span>`:""}</div>
    <div class="cv-plot">${catPathSVG(c,code)}<div class="cv-tip" hidden></div></div>
    <details class="cv-table"><summary>표로 보기</summary><table><thead><tr><th>#</th><th>난이도</th><th>결과</th><th>추정 실력</th></tr></thead><tbody>${rows}</tbody></table></details></div>`;
}
// 차트 위에서 손가락/마우스를 움직이면 가장 가까운 문항으로 스냅해 값 표시 (표로 보기에도 같은 값)
function catVizBind(root){
  $$(".catviz",root||document).forEach(box=>{ if(box._bound) return; box._bound=1;
    const svg=$(".cv-svg",box), tip=$(".cv-tip",box), cross=$(".cv-cross",box); if(!svg) return;
    let path=[]; try{ path=JSON.parse(box.dataset.path||"[]"); }catch{}
    const slots=+svg.dataset.slots, L=+svg.dataset.l, pw=+svg.dataset.pw;
    const show=ev=>{ if(!path.length) return; const r=svg.getBoundingClientRect(), vx=(ev.clientX-r.left)/r.width*340;
      const i=clamp(Math.round((vx-L)/(pw/slots)+0.5),1,path.length), p=path[i-1], x=L+(i-0.5)*pw/slots;
      cross.setAttribute("x1",x.toFixed(1)); cross.setAttribute("x2",x.toFixed(1)); cross.style.display="";
      tip.replaceChildren();
      const a=document.createElement("b"); a.textContent=`${CAT_LV_KO[p[0]]} · ${p[1]?"✓ 정답":"✕ 오답"}`;
      const b=document.createElement("span"); b.textContent=`${i}번째 문항 · 추정 실력 ${fmtTh(p[2])}`;
      tip.append(a,b); tip.hidden=false;
      const px=x/340*r.width; tip.style.left=(px>r.width/2?Math.max(0,px-172):Math.min(px+12,r.width-162))+"px"; };   // 커서 반대편에 띄워 선을 가리지 않게
    const hide=()=>{ tip.hidden=true; cross.style.display="none"; };
    svg.addEventListener("pointermove",show); svg.addEventListener("pointerdown",show); svg.addEventListener("pointerleave",hide);
  });
}

/* ---------- 제출 (exam.js의 submitExam에서 cat이면 이쪽) ---------- */
function submitCat(auto){
  const e=exam; if(!e||e.submitted) return;
  e.submitted=true; stopExamTimer(); clearExamSnap(); examReleaseWake(); closeOpenQuestion(e);
  const res={}, bySec={}, counted=[], skipped=[];
  for(const s of e.sections){
    if(s.from==null){ skipped.push(s.code); continue; }
    const c=catScoreSection(e,s); res[s.code]=c;
    const idxs=catSecRange(s); counted.push(...idxs); bySec[s.code]={got:c.got,total:idxs.length}; }
  if(!counted.length){ toast("푼 문항이 없어 기록 없이 종료했어요."); const from=e.from; exam=null; go(from); return; }
  e._skipped=skipped; e._counted=counted;
  let got=0, answered=0;
  counted.forEach(i=>{ const it=e.items[i], ok=e.answers[i]===it.answer; if(ok) got++; if(e.locked[i]&&e.answers[i]!=null) answered++;
    if(!e.recorded[i]){ recordResult(it,ok); e.recorded[i]=true; } });
  // 초반 5문제 (섹션 첫 5문항 — 적응형에서 출발점을 정하는 구간)
  const f5={};
  if(!e.practice) for(const s of e.sections){ const r=catSecRange(s).slice(0,5); if(!r.length) continue;
    f5[s.code]=[r.filter(i=>e.answers[i]===e.items[i].answer).length, r.length];
    const g=state.first5[s.code]||(state.first5[s.code]={c:0,n:0}); g.c+=f5[s.code][0]; g.n+=f5[s.code][1]; }
  const speedBySec={};
  counted.forEach(i=>{ const it=e.items[i]; if(e.answers[i]==null) return; const ms=e.times[i]||0; if(!ms) return; const tgt=(SECRATE[it.section]||30)*1000;
    const o=speedBySec[it.section]||(speedBySec[it.section]={n:0,ms:0,slow:0}); o.n++; o.ms+=ms; if(ms>tgt*1.3) o.slow++;
    const gs=state.speed[it.section]||(state.speed[it.section]={n:0,ms:0,slow:0}); gs.n++; gs.ms+=ms; if(ms>tgt*1.3) gs.slow++; });
  const used=e.sections.reduce((a,s)=>a+(s.from==null?0:(s.secs-Math.max(0,s.leftAtDone!=null?s.leftAtDone:s.left))),0);
  bumpDay({studied:answered,correct:got,seconds:used});
  const total=counted.length, codes=Object.keys(res);
  const oar=(!e.practice&&OAR_SUBS.every(k=>res[k]))?oarFromAcc(Object.fromEntries(OAR_SUBS.map(k=>[k,res[k].acc]))):null;
  const sc=codes.length===1?res[codes[0]].sc:null;
  const score=oar!=null?oar:sc!=null?sc:Math.round(codes.reduce((t,k)=>t+res[k].sc,0)/codes.length);
  if(e.key&&!e.practice){ const prev=state.exams[e.key], fresh=!prev||prev.scale!=="oar";
    state.exams[e.key]={scale:"oar",best:fresh?score:Math.max(prev.best||0,score),bestTotal:80,last:score,lastTotal:80,date:todayStr(),updated_at:nowISO()}; }
  if(MOCK_KEYS.has(e.key)&&!e.practice) statBump("mock");
  const h={key:e.key||"cat",name:e.name,kind:e.kind,date:todayStr(),got,total,acc:got/total,ts:Date.now(),secs:used,
    bySec:JSON.parse(JSON.stringify(bySec)),f5:Object.keys(f5).length?f5:undefined,practice:e.practice?1:undefined,
    skipped:skipped.length?skipped.slice():undefined, cat:res, sc:sc!=null?sc:undefined,
    items:counted.map(i=>({id:e.items[i].qid,u:e.answers[i],a:e.items[i].answer,ms:Math.round(e.times[i]||0)}))};
  if(oar!=null) h.oar=oar;
  state.examHist.push(h); if(state.examHist.length>200) state.examHist=state.examHist.slice(-200);
  pruneExamDetail(); saveNow(); if(typeof queuePush==="function") queuePush("app_state");
  renderCatResult(e,{got,total,res,oar,sc,score,used,speedBySec,skipped,f5});
}
function renderCatResult(e,r){
  $$(".view").forEach(v=>v.classList.remove("active")); $("#view-exam").classList.add("active");
  $("#examRun").classList.add("hidden"); $("#examResult").classList.remove("hidden");
  const codes=Object.keys(r.res);
  $("#examEmoji").textContent=r.score>=60?"🏆":r.score>=TARGET_OAR?"🎯":r.score>=40?"💪":"📚";
  $("#examScore").textContent=r.oar!=null?`예상 OAR ${r.oar} / 80`:codes.length===1?`${SUBMETA[codes[0]].ko} 환산 ${r.sc} / 80`:`환산 평균 ${r.score} / 80`;
  $("#examBreakDown").innerHTML=codes.length>1?codes.map(k=>`<div class="s"><b>${r.res[k].sc}</b><span>${SUBMETA[k].ko} 환산</span></div>`).join(""):"";
  const proj=$("#examProjection"); proj.classList.remove("hidden");
  const head=r.oar!=null?`<div class="lbl">예상 OAR (비공식 · 적응형 채점)</div><div class="big">${r.oar}<span style="font-size:15px"> / 80</span></div>
      <div class="seclist">상위 약 ${catTopPct(r.oar)}% · 목표 ${TARGET_OAR}+ ${r.oar>=TARGET_OAR?"✅":"⬆️"}</div>`
    :`<div class="lbl">${e.practice?"연습 모드 결과 (시간 2.2배 · 점수는 참고용)":"적응형 채점 결과 (비공식)"}</div>`;
  const pens=codes.filter(k=>r.res[k].pen), f5=r.f5&&Object.keys(r.f5).length?`<div class="seclist">초반 5문제 정답: ${Object.keys(r.f5).map(k=>`${k} ${r.f5[k][0]}/${r.f5[k][1]}`).join(" · ")}</div>`:"";
  proj.innerHTML=`${head}${f5}
    <div class="note" style="text-align:left;margin-top:10px">💡 <b>적응형 채점</b> — 실력에 맞춰 문제가 어려워지기 때문에 정답률은 누구나 50–70% 근처로 모여요.
      점수는 맞힌 개수가 아니라 <b>어느 난이도의 문제를 맞혔는지</b>로 정해져요. 아래 그래프에서 파란 선이 위로 올라갈수록 점수가 높아요.</div>
    ${pens.length?`<div class="note" style="text-align:left;color:var(--warn)">⏰ ${pens.map(k=>`${k} ${r.res[k].pen}문항`).join(" · ")} 미응답 → 감점이 반영됐어요. 실전에서는 페이스 조절이 점수예요.</div>`:""}
    ${codes.map(k=>catVizHTML(r.res[k],k)).join("")}
    <div class="note">${OAR_NOTE} 난이도는 문항 작성 기준의 근사값이에요.</div>`;
  catVizBind(proj);
  const lines=e.sections.filter(s=>s.from!=null).map(s=>{ const left=s.leftAtDone!=null?s.leftAtDone:Math.max(0,s.left);
    return `${s.code} ${fmtTime(s.secs-left)}/${fmtTime(s.secs)}${s.autoOut&&left<=0?"⏰":""}`; }).join(" · ");
  $("#examTimeUsed").innerHTML=`소요 시간 ${fmtTime(r.used)}<br><span style="font-size:11.5px">${esc(lines)}</span>`;
  const sp=$("#examSpeed"), keys=Object.keys(r.speedBySec);
  if(!keys.length) sp.classList.add("hidden");
  else { sp.classList.remove("hidden");
    sp.innerHTML=`<div style="font-weight:700;font-size:12.5px;margin-bottom:6px">⚡ 풀이 속도 (실전 배분 대비)</div><div class="row wrap" style="gap:6px;justify-content:center">${
      keys.map(k=>{ const o=r.speedBySec[k], avg=Math.round(o.ms/o.n/1000), tgt=SECRATE[k], ok=avg<=tgt;
        return `<span class="pill" style="${ok?"":"color:var(--warn)"}">${k} ${avg}초${ok?"":"🐢"}<small>/${tgt}초</small></span>`; }).join(" ")}</div>`; }
  $("#examReview").innerHTML=""; $("#examReviewBtn").classList.remove("hidden");
  $("#examRetry").classList.toggle("hidden",!e.key||!EXAM_PRESETS[e.key]);
  $("#examDoneHome").textContent={mock:"모의고사로",plan:"플랜으로",wrong:"오답노트로",home:"홈으로"}[e.from]||(String(e.from).startsWith("sub:")?"과목으로":"돌아가기");
  if(r.total-r.got>0){ renderExamReview(); $("#examReviewBtn").classList.add("hidden"); }
  window.scrollTo(0,0);
}
