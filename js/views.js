/* ============================================================
   ASTB-E Prep — views.js
   라우터 · 홈 · 플랜(Phase 0/1/2) · 과목 허브 · 훑어보기 · 용어집/플래시카드
   모의고사 · 오답노트 · 통계 · 시험 기록 · 가이드 · 설정 · 온보딩 · 이벤트 연결
   ============================================================ */
"use strict";

let curView="home", subCur="MST", guideCur="overview", guideBack="home";
let browseCtx={sub:"MST",topic:"",q:"",limit:25}, termsCtx={cat:"",q:"",limit:40}, wrongCtx={tab:"due"}, examlogOpen=null;
let flashSes=null;

/* ---------- 플랜 데이터 (볼트 노트 '03 ASTB-E 공부 계획' §Phase 0–2) ---------- */
const PHASES=[
  {pill:"PHASE 0 · 겸용", name:"Phase 0 — 겸용 (지금 ~ 졸업)", desc:"ASTB-E 전용 시간은 0. AFOQT 3차 준비와 겹치는 수학·항공만 '이중 투자'로 챙긴다."},
  {pill:"PHASE 1 · 진단", name:"Phase 1 — 진단 1주 (졸업 직후)", desc:"과목별 진단으로 현재 실력을 재고 Phase 2 시간 배분을 정한다."},
  {pill:"PHASE 2 · 집중", name:"Phase 2 — 집중 10주", desc:"시간 배분 MCT > PBM > ANIT(해상) > MST > RCT. 매주 원리 → 드릴 → 오답 로그 → 시간 제한 세트."},
];
const MST_WEAK=["geometry_measure","unit_conversion","word_problems"];
const P2_WEEKS=[
  {weeks:[1,2], main:{sub:"MCT",topics:["levers","pulleys","gears_belts","inclined_screw_wedge","work_energy_power"],label:"MCT 기초 — 지렛대·도르래·기어비·경사면"},
    second:{sub:"MST",topics:MST_WEAK,label:"MST 약점 복습 (3D·단위환산·이자)"}, out:"공식 한 장 요약"},
  {weeks:[3,4], main:{sub:"MCT",topics:["fluids_pressure","bernoulli_buoyancy","springs","electricity_circuits","magnetism","gases_heat"],label:"MCT 심화 — 유체·압력·스프링·전기"},
    second:{sub:"ANIT",naval:true,label:"ANIT 해상 — 함정·계급·항모·조함"}, out:"해상 용어 카드 1회독"},
  {weeks:[5,6], main:{sub:"ANIT",aviation:true,label:"PBM 연습 시작(주 3회) + ANIT 항공 복습"},
    second:{sub:"MST",topics:MST_WEAK,label:"MST 유지"}, pbm:true, out:"PBM 세션 기록"},
  {weeks:[7,8], main:{weak:true,label:"과목 혼합 세트 · 약점 유형 반복"},
    second:{sub:"MST",set:true,label:"MST 속도 훈련 (시간 제한 SET)"}, pbm:true, out:"오답노트 정리"},
  {weeks:[9], main:{weak:true,label:"모의고사 1 → 약점 보강"}, second:{sub:"MCT",set:true,label:"MCT 시간 제한 SET"}, pbm:true, mock:true, out:"점수 기록"},
  {weeks:[10], main:{weak:true,label:"모의고사 2 → 응시 Go/No-Go 판단"}, second:{sub:"ANIT",set:true,label:"ANIT 시간 제한 SET"}, pbm:true, mock:true, out:"응시 Go / No-Go"},
];
function p2Week(){ const s=state.settings.p2start||todayStr(); return Math.max(1, Math.floor(dayDiff(s,todayStr())/7)+1); }
function p2Plan(){ const w=Math.min(10,p2Week()); return P2_WEEKS.find(x=>x.weeks.includes(w))||P2_WEEKS[P2_WEEKS.length-1]; }
function worstTopic(){ let best=null;
  for(const [k,v] of Object.entries(state.weak.topic||{})){ const n=(v.c||0)+(v.w||0); if(n<4) continue; const acc=v.c/n;
    if(!best||acc<best.acc) best={k,acc,n}; }
  return best; }
function examToday(test){ const t=todayStr(); return (state.examHist||[]).some(h=>h.date===t&&test(h)); }
function pbmToday(){ const t=todayStr(); return (state.pbmLog||[]).some(x=>!x.del&&x.date===t); }

/* 오늘 할 일: {id, label, sub, done, act} — 자동 체크 + 수동 체크(원 탭) */
function drillTask(id, spec, n, learn=true){
  if(spec.weak){ const w=worstTopic(); if(w){ const [s,key]=w.k.split(":");
      return {id,label:`약점 유형 드릴 ${n}문제 — ${s} ${weakLabel(w.k)}`,sub:`현재 정답률 ${Math.round(w.acc*100)}% (${w.n}문항)`,done:todayStat(s)>=n,
        act:()=>startDrill(s,{...(s==="RCT"?{qtype:key}:{topic:key}),n,label:`약점: ${weakLabel(w.k)}`,from:"plan"})}; }
    return {id,label:`혼합 드릴 ${n}문제 (약점 데이터 쌓는 중)`,sub:"과목별 실전을 먼저 풀면 약점 유형이 잡혀요",done:todayStat("MCT")>=n,act:()=>startDrill("MCT",{n,from:"plan"})}; }
  if(spec.set){ const sets=bankSets(spec.sub), ex=state.exams, i=Math.max(0,sets.findIndex((_,k)=>!ex[`set:${spec.sub}:${k+1}`]));
    const key=`set:${spec.sub}:${(i>=0?i:0)+1}`;
    return {id,label:`${spec.label} — ${spec.sub} SET ${String((i>=0?i:0)+1).padStart(2,"0")}`,sub:"시간 제한 · 되돌아가기 금지",
      done:examToday(h=>String(h.key).startsWith(`set:${spec.sub}:`)),act:()=>startExam(key,{from:"plan"})}; }
  const f=spec.topics?(q=>spec.topics.includes(q.topic)):spec.naval?(q=>NAVAL_TOPICS.has(q.topic)):spec.aviation?(q=>!NAVAL_TOPICS.has(q.topic)):null;
  return {id,label:`${spec.label} — ${n}문제${learn?" (해설 즉시)":""}`,sub:`${spec.sub} 누적 오늘 ${todayStat(spec.sub)}/${n}`,done:todayStat(spec.sub)>=n,
    act:()=>startDrill(spec.sub,{filter:f,n,learn,label:spec.label,from:"plan"})};
}
function wrongTask(){ const due=dueWrongs().length; if(!due&&!todayStat("review")) return null;
  return {id:"wrong",label:due?`오늘 다시 볼 오답 ${due}문제`:"오늘 다시 볼 오답 — 완료",sub:"첫 오답 3일 뒤 · 다시 틀리면 1일 뒤 · 연속 2번 맞히면 졸업",
    done:due===0,act:()=>startWrongReview({due:true})}; }
function termsTask(n){ return {id:"terms",label:`용어 카드 ${n}장 (복습 우선 · 해상 먼저)`,sub:`오늘 ${todayStat("terms")}장`,done:todayStat("terms")>=n,act:()=>go("flash")}; }
function planTasks(){
  const ph=+state.settings.phase||0, dow=new Date().getDay(), T=[];
  if(ph===0){
    const topic=MST_WEAK[(dayDiff("2026-01-01",todayStr())%3+3)%3];
    T.push({id:"p0-mst",label:`MST 약점 10문제 — ${topicKo("MST",topic)}`,sub:"AFOQT 수학 오답노트와 겸용 (3D·단위환산·이자 순환)",done:todayStat("MST")>=10,
      act:()=>startDrill("MST",{topic,n:10,label:`MST 약점: ${topicKo("MST",topic)}`,from:"plan"})});
    T.push(drillTask("p0-anit",{sub:"ANIT",aviation:true,label:"ANIT 항공 복습"},10));
    T.push(termsTask(10));
    const w=wrongTask(); if(w) T.push(w);
    if(dow===6) T.push({id:"p0-set",label:"(선택) 주말: MST 시간 제한 SET 1개",sub:"계산기 없이·되돌아가기 금지",done:examToday(h=>String(h.key).startsWith("set:MST:")),
      act:()=>{ const sets=bankSets("MST"), i=Math.max(0,sets.findIndex((_,k)=>!state.exams[`set:MST:${k+1}`])); startExam(`set:MST:${i+1}`,{from:"plan"}); }});
    return T;
  }
  if(ph===1){
    const has=k=>(state.examHist||[]).some(h=>h.key===k&&!h.learn);
    T.push({id:"p1-diag",label:"진단 미니 모의고사 (약 34분)",sub:"MST 10 · RCT 7 · MCT 10 · ANIT 10",done:has("diag"),act:()=>startExam("diag",{from:"plan"})});
    for(const s of ["MCT","ANIT","MST","RCT"]) T.push({id:"p1-"+s,label:`${s} 실전 진단 ${SUBMETA[s].n}문항 (${SUBMETA[s].secs/60}분)`,sub:SUBMETA[s].desc,done:has("sub:"+s),act:()=>startExam("sub:"+s,{from:"plan"})});
    T.push({id:"p1-oar",label:"OAR 모의고사 (85분)",sub:"MST 30 + RCT 20 + MCT 30",done:has("oar"),act:()=>startExam("oar",{from:"plan"})});
    T.push({id:"p1-review",label:"통계 → 약점 분석 확인 후 Phase 2 시작일 정하기",sub:"⚙️ 설정에서 Phase 2 + 시작일 입력",done:false,act:()=>go("stats")});
    return T;
  }
  const P=p2Plan(), w=wrongTask();
  if(dow===1||dow===2){
    const s=P.main.sub||"MCT";
    T.push({id:"p2-principle",label:`원리 학습: ${P.main.label}`,sub:`${SUBMETA[s].ko} 유형 노트 읽고 → '${P.out}'`,done:false,act:()=>go("sub:"+s)});
    T.push(drillTask("p2-main",P.main,20)); T.push(drillTask("p2-second",P.second,10));
  } else if(dow===3||dow===4){
    T.push(drillTask("p2-main",P.main,30)); T.push(drillTask("p2-second",P.second,20));
    if(P.pbm&&dow===3) T.push({id:"p2-pbm",label:"PBM 30분 (조이스틱+스로틀)",sub:"끝나면 통계 탭에 세션 기록",done:pbmToday(),act:()=>{ go("stats"); setTimeout(()=>$("#pbmForm")?.scrollIntoView({behavior:"smooth"}),80); }});
  } else if(dow===5){
    T.push(P.pbm?{id:"p2-pbm",label:"PBM 30분 (조이스틱+스로틀)",sub:"끝나면 통계 탭에 세션 기록",done:pbmToday(),act:()=>{ go("stats"); setTimeout(()=>$("#pbmForm")?.scrollIntoView({behavior:"smooth"}),80); }}
      :drillTask("p2-main",P.main,20));
    T.push(termsTask(20));
  } else if(dow===6){
    if(P.mock) T.push({id:"p2-mock",label:"모의고사 (학과 전체 100분 또는 고정 Form)",sub:"실전처럼: 계산기 X · 되돌아가기 X",done:examToday(h=>MOCK_KEYS.has(h.key)),act:()=>go("mock")});
    else { T.push(drillTask("p2-set1",{sub:P.main.sub||"MCT",set:true,label:"시간 제한 혼합 세트"},0)); T.push(drillTask("p2-set2",{...P.second,set:true,label:"시간 제한 세트"},0)); }
  } else {
    const untagged=activeWrongs().filter(([,x])=>!x.reason).length;
    T.push({id:"p2-reason",label:`오답 로그 정리 — 틀린 이유 미분류 ${untagged}개`,sub:"① 원리 모름 ② 적용 실수 ③ 계산 실수 ④ 시간 부족",done:untagged===0,act:()=>{ wrongCtx={tab:"all"}; go("wrong"); }});
    T.push(termsTask(20));
    T.push({id:"p2-next",label:"다음 주 주력 과목 확인 (통계 → 약점)",sub:"",done:false,act:()=>go("stats")});
  }
  if(P.pbm&&dow===1) T.push({id:"p2-pbm",label:"PBM 30분 (조이스틱+스로틀)",sub:"끝나면 통계 탭에 세션 기록",done:pbmToday(),act:()=>go("stats")});
  if(w) T.push(w);
  return T;
}
function taskDone(t){ const ck=state.checklist[todayStr()]||{}; return !!(t.done||ck[t.id]); }
function planAllDone(){ const T=planTasks(); return T.length>0 && T.every(taskDone); }

/* ---------- router ---------- */
const NAV_OF={browse:()=>"sub:"+browseCtx.sub, terms:()=>"sub:ANIT", flash:()=>"sub:ANIT", wrong:()=>"mock", examlog:()=>"stats", guide:()=>guideBack, exam:()=>exam?exam.from:"mock"};
function go(view){
  if(exam&&!exam.submitted&&view!=="exam"){ settleExamClock(); if(exam&&!exam.submitted){ closeOpenQuestion(exam); saveExamSnap(true); stopExamTimer(); examReleaseWake(); exam=null;
      toast("⏸ 시험을 멈췄어요 — 모의고사 화면에서 이어 풀 수 있어요.",2600); } }
  if(exam&&exam.submitted&&view!=="exam") exam=null;
  const base=view.startsWith("sub:")?"sub":view;
  if(view.startsWith("sub:")) subCur=view.slice(4);
  if(view!=="flash") flashSes=null;
  curView=view;
  $$(".view").forEach(v=>v.classList.remove("active")); const el=$("#view-"+base); if(el) el.classList.add("active");
  const navKey=NAV_OF[base]?NAV_OF[base]():view;
  $$("#nav button[data-go]").forEach(b=>b.classList.toggle("on",b.dataset.go===navKey));
  window.scrollTo(0,0);
  renderView(base);
}
function renderView(base){
  ({home:renderHome,plan:renderPlan,sub:renderSub,browse:renderBrowse,terms:renderTerms,flash:renderFlash,mock:renderMock,
    wrong:renderWrong,stats:renderStats,examlog:renderExamLog,guide:renderGuide}[base]||(()=>{}))();
}
function sessionActive(){ return !!(exam&&!exam.submitted)||!!flashSes; }
function softRender(){ if(!state||sessionActive()) return; const base=curView.startsWith("sub:")?"sub":curView; if(base==="exam") return; renderView(base); }
function openGuide(key,back){ guideCur=key; guideBack=back||curView; go("guide"); }

/* ---------- home ---------- */
function renderHome(){
  const s=state.settings, ph=+s.phase||0, streak=computeStreak();
  $("#heroPhase").textContent=PHASES[ph].pill;
  if(s.exam_date){ const dl=dayDiff(todayStr(),s.exam_date); $("#heroLabel").textContent="ASTB-E까지"; $("#heroNum").textContent=dl>=0?dl:"—"; $("#heroUnit").textContent="일";
    $("#heroLine").textContent=`응시 예정 ${s.exam_date}`; }
  else { $("#heroLabel").textContent="연속 학습"; $("#heroNum").textContent=streak; $("#heroUnit").textContent="일"; $("#heroLine").textContent="응시일 미정 · 정해지면 ⚙️에서 입력"; }
  const T=planTasks(), done=T.filter(taskDone).length, p=T.length?Math.round(done/T.length*100):0;
  $("#goalRing").style.setProperty("--p",p); $("#ringPct").textContent=p+"%";
  const rd=SUBS.map(x=>({s:x,r:readiness(x)})), have=rd.filter(x=>x.r!=null);
  const avg=have.length?Math.round(have.reduce((t,x)=>t+x.r,0)/have.length):0;
  $("#overallBar").style.width=avg+"%";
  $("#overallLine").textContent=have.length?`과목 준비도 평균 ${avg}%${have.length<4?` · 진단 필요: ${rd.filter(x=>x.r==null).map(x=>x.s).join(", ")}`:""}`:"과목 준비도 — 진단 모의고사를 풀면 계산돼요";
  const est=estOAR();
  $("#oarLine").innerHTML=est.oar!=null?`예상 OAR <b style="font-size:16px">${est.oar}</b> (비공식) · 목표 ${TARGET_OAR}+ ${est.oar>=TARGET_OAR?"✅":""}`:`예상 OAR — ${est.missing.join("·")} 진단 후 표시`;
  const last=[...realExams()].reverse().find(h=>MOCK_KEYS.has(h.key)||h.key==="diag");
  $("#homeProj").innerHTML=!last?`<div class="card" style="border-color:var(--brand)"><b>🩺 먼저 현재 실력부터 재 볼까요?</b>
      <div class="muted" style="font-size:12.5px;margin:6px 0 10px">진단 미니 모의고사(약 34분) — 끝나면 과목별 준비도와 예상 OAR이 채워져요.</div>
      <button class="btn primary" id="homeDiag">🩺 진단 미니 모의고사 시작</button></div>`
    :`<div class="card tight"><div class="row" style="justify-content:space-between;align-items:center"><div><div class="muted" style="font-size:11.5px">최근 모의고사 · ${fmtDate(last.date)}</div>
      <b>${esc(last.name)}</b></div><div style="text-align:right"><b style="font-size:20px">${last.oar!=null?last.oar:Math.round(last.acc*100)+"%"}</b><div class="muted" style="font-size:11px">${last.oar!=null?"예상 OAR":"정답률"}</div></div></div></div>`;
  const hd=$("#homeDiag"); if(hd) hd.onclick=()=>startExam("diag",{from:"home"});
  $("#stStreak").textContent=streak; $("#stToday").textContent=getDay().studied||0; $("#stDue").textContent=dueWrongs().length;
  $("#homeSubs").innerHTML=SUBS.map(x=>{ const m=SUBMETA[x], r=readiness(x), a=subtestAcc(x), seen=Object.keys(state.qSeen[x]||{}).length, wn=activeWrongs(x).length;
    return `<button class="seccard" data-go="sub:${x}" style="width:100%;text-align:left"><div class="ic">${m.icon}</div><div class="meta"><b>${x} · ${m.ko}</b>
      <div class="muted" style="font-size:12px">${a?`정답률 ${Math.round(a.acc*100)}%`:"진단 전"} · 본 문제 ${seen}/${POOL[x].length}${wn?` · 오답 ${wn}`:""}</div>
      <div class="progressbar mini"><i style="width:${r||0}%"></i></div></div><div class="go">›</div></button>`; }).join("");
  $$("#homeSubs [data-go]").forEach(b=>b.onclick=()=>go(b.dataset.go));
  const g=goNoGo();
  $("#homeGng").innerHTML=`<div class="gng">${g.rows.map(r=>`<div class="gng-row ${r.ok?"ok":""}"><span class="st">${r.ok?"✓":""}</span><div><div>${esc(r.label)}</div><div class="sub">${esc(r.sub)}</div></div></div>`).join("")}</div>
    <div class="gng-verdict" style="color:${g.go?"var(--ok)":"var(--muted)"}">${g.go?"✅ 응시 조건 충족 — 평생 3회 중 1회를 써도 되는 수준":`No-Go · ${g.n}/4 충족 — 넷 다 채운 뒤 응시`}</div>`;
  const other=[["overview","🧭","시험 구조 · 이 앱 사용법","7개 서브테스트, 점수, 학습 사이클"],["pbm","🕹️","PBM (실기) 안내","추적·양분 청취·방향·비상 대응 — 2단계에서 시뮬레이터"],
    ["scoring","📊","점수 체계","OAR 20–80 · AQR/PFAR/FOFAR 스타나인"],["retake","🔁","재시험 규칙","평생 3회 · 31일/91일 · 최신 점수 대체"],
    ["natfi","🧠","NATFI 성향 검사","솔직·일관 — 준비 불필요"],["birv","📝","BI-RV 경험 설문","사실대로 · 응답 검증"]];
  $("#homeOther").innerHTML=other.map(([k,ic,t,d])=>`<button class="seccard" data-guide="${k}" style="width:100%;text-align:left"><div class="ic">${ic}</div><div class="meta"><b>${t}</b><div class="muted" style="font-size:12px">${d}</div></div><div class="go">›</div></button>`).join("");
  $$("#homeOther [data-guide]").forEach(b=>b.onclick=()=>openGuide(b.dataset.guide,"home"));
}

/* ---------- plan ---------- */
function renderPlan(){
  const s=state.settings, ph=+s.phase||0, T=planTasks(), done=T.filter(taskDone).length;
  let head=`<div class="muted" style="font-size:12px">${PHASES[ph].pill}</div><div class="plan-day">${esc(PHASES[ph].name)}</div>
    <div class="muted" style="font-size:12.5px;margin-top:6px;line-height:1.55">${esc(PHASES[ph].desc)}</div>`;
  if(ph===2){ const P=p2Plan(), w=p2Week(); head+=`<div class="hintbox" style="margin-top:10px"><b>${Math.min(w,10)}주차${w>10?" (10주 완료 — 응시 판단)":""}</b> · 주력: ${esc(P.main.label)} · 보조: ${esc(P.second.label)} · 산출물: ${esc(P.out)}${s.p2start?"":"<br>⚠️ ⚙️ 설정에서 Phase 2 시작일을 입력하면 주차가 정확해져요."}</div>`; }
  head+=`<div class="wp-bar"><i style="width:${T.length?done/T.length*100:0}%"></i></div><div class="muted" style="font-size:12px">오늘 ${done}/${T.length} 완료 · ${["일","월","화","수","목","금","토"][new Date().getDay()]}요일</div>`;
  $("#planHead").innerHTML=head;
  $("#planTasks").innerHTML=T.map((t,i)=>{ const d=taskDone(t); return `<div class="ptask ${d?"on":""}"><button class="pchk" data-ck="${t.id}" aria-label="체크">${d?"✓":i+1}</button>
    <div class="pmeta"><div class="pl">${esc(t.label)}</div>${t.sub?`<div class="ps">${esc(t.sub)}</div>`:""}</div><button class="btn sm ${d?"ghost":"primary"} pgo" data-i="${i}">${d?"다시":"시작"}</button></div>`; }).join("")||`<div class="card muted">오늘 할 일이 없어요.</div>`;
  $$("#planTasks [data-i]").forEach(b=>b.onclick=()=>{ const t=T[+b.dataset.i]; if(t&&t.act) t.act(); });
  $$("#planTasks [data-ck]").forEach(b=>b.onclick=()=>{ const day=todayStr(), ck=state.checklist[day]||(state.checklist[day]={}), id=b.dataset.ck;
    if(ck[id]) delete ck[id]; else ck[id]=1; const d=getDay(); d.goal_met=d.studied>=DAILY_MIN||planAllDone(); d.updated_at=nowISO(); saveLocal(); if(typeof queuePush==="function") queuePush("daily_log",{day,...d}); renderPlan(); });
  $("#planAllDone").classList.toggle("hidden",!(T.length&&done===T.length));
  let rm="";
  if(ph===0) rm=`<div class="wp-task"><div class="wp-box"></div><div class="tx">AFOQT 수학 오답노트 60문항 채우기 → <b>MST 겸용</b> (3D도형·단위환산·이자)</div></div>
    <div class="wp-task"><div class="wp-box"></div><div class="tx">Barron's 7장 항공 코스 완주 → <b>ANIT 항공 겸용</b></div></div>
    <div class="wp-task"><div class="wp-box"></div><div class="tx">버벌 3차 준비의 독해 연습 → <b>RCT 부수 효과</b></div></div>
    <div class="wp-task"><div class="wp-box"></div><div class="tx">(여유 있을 때만) 해상 용어 카드 조금씩 — 졸업 후 Phase 1 진단으로</div></div>`;
  else if(ph===1) rm=`<div class="muted" style="font-size:13px;line-height:1.6">WES 재평가 신청과 같은 주에 시작 → 과목별 진단 → 약점 분석 → 리크루터에게 괌 응시 시기 확인 → 역산해서 Phase 2 시작일 확정.</div>`;
  else { const w=Math.min(10,p2Week()); rm=P2_WEEKS.map(x=>{ const on=x.weeks.includes(w); return `<div class="wp-task ${x.weeks.every(k=>k<w)?"on":""}" style="${on?"background:#6366f11f;border-radius:10px":""}">
      <div class="wp-box">${x.weeks.every(k=>k<w)?"✓":""}</div><div class="tx"><b>${x.weeks.join("–")}주</b> · ${esc(x.main.label)}<br><span class="muted" style="font-size:12px">보조: ${esc(x.second.label)} · 산출물: ${esc(x.out)}</span></div></div>`; }).join("")
      +`<div class="muted" style="font-size:12px;margin-top:10px;line-height:1.6">요일 사이클: 월·화 원리 → 수·목 유형 드릴 → 금 PBM + 오답 재풀이 → 토 시간 제한 세트 → 일 오답 로그 정리 + 용어</div>`; }
  $("#planRoadmap").innerHTML=rm;
}

/* ---------- subject hub ---------- */
function topicAccHTML(k){ const v=state.weak.topic[k]; if(!v) return `<span class="tacc muted">–</span>`; const n=v.c+v.w, a=Math.round(v.c/n*100);
  return `<span class="tacc" style="color:${a>=80?"var(--ok)":a>=60?"var(--warn)":"var(--bad)"}">${a}%<span class="muted" style="font-weight:500"> (${n})</span></span>`; }
function noteBody(n){ if(!n) return `<div class="muted small">유형 노트 준비 중이에요.</div>`;
  return `<ul>${(n.pts||[]).map(p=>`<li>${fmtMath(p)}</li>`).join("")}</ul>
    ${n.steps?`<div class="kv"><b>푸는 순서</b> · ${fmtMath(n.steps)}</div>`:""}${n.trap?`<div class="kv"><b>함정</b> · ${fmtMath(n.trap)}</div>`:""}
    ${n.example?`<div class="ex"><b>예제</b> ${fmtMath(n.example.q)}<br><b>답</b> ${fmtMath(n.example.a)} — ${fmtMath(n.example.explain)}</div>`:""}`; }
function renderSub(){
  const s=subCur, m=SUBMETA[s], pool=POOL[s], a=subtestAcc(s), r=readiness(s), seen=Object.keys(state.qSeen[s]||{}).length, wn=activeWrongs(s).length;
  const notes=TOPICNOTES[s]||[];
  let html=`<div class="sub-head"><div class="ic">${m.icon}</div><div><h2>${s} · ${m.ko}</h2><div class="en">${m.en}</div></div></div>
    <div class="spec-line">실전: ${m.spec}</div>
    <div class="grid2"><div class="card tight stat"><div class="num">${a?Math.round(a.acc*100)+"%":"–"}</div><div class="lbl">정답률${a?` (${a.n}문항${a.src==="exam"?" · 최근 실전":""})`:""}</div></div>
      <div class="card tight stat"><div class="num">${r!=null?r:"–"}</div><div class="lbl">준비도 · 본 문제 ${seen}/${pool.length}</div></div></div>
    <button class="btn primary mt12" data-exam="sub:${s}">🎯 실전 ${m.n}문항 · ${m.secs/60}분 (덜 본 문제 우선)</button>
    <div class="row mt8" style="gap:8px"><button class="btn ghost" data-exam-practice="sub:${s}" style="flex:1;font-size:14px">⏳ 연습 모드 (시간 2.2배)</button>
      <button class="btn ghost" data-wrongsub="${s}" style="flex:1;font-size:14px">📕 오답 ${wn}</button></div>`;
  if(s==="MCT") html+=`<h2 class="section">⚙️ 원리 5개 — 한 장 요약</h2><div class="principles">${MCT_PRINCIPLES.map(p=>`<div class="principle"><b>${p.name}</b>${renderFig(p.fig)}<div class="rule">${fmtMath(p.rule)}</div></div>`).join("")}</div>`;
  if(s==="ANIT"){ const due=TERMS.filter(t=>termDue(state.terms[t.id])).length, fresh=TERMS.filter(t=>!state.terms[t.id]||state.terms[t.id].status==="new").length;
    const nav=Object.entries(state.weak.topic).filter(([k])=>k.startsWith("ANIT:")&&NAVAL_TOPICS.has(k.slice(5))).reduce((t,[,v])=>({c:t.c+v.c,n:t.n+v.c+v.w}),{c:0,n:0});
    const avi=Object.entries(state.weak.topic).filter(([k])=>k.startsWith("ANIT:")&&!NAVAL_TOPICS.has(k.slice(5))).reduce((t,[,v])=>({c:t.c+v.c,n:t.n+v.c+v.w}),{c:0,n:0});
    html+=`<div class="hintbox mt12">항공 ${avi.n?Math.round(avi.c/avi.n*100)+"%":"–"} (${avi.n}) · <b>해상 ${nav.n?Math.round(nav.c/nav.n*100)+"%":"–"}</b> (${nav.n}) — 해상은 완전 신규라 카드로 먼저 1회독하세요.</div>
      <div class="row mt12" style="gap:8px"><button class="btn primary" id="goFlash" style="flex:1">🃏 용어 카드 · 복습 ${due} · 신규 ${fresh}</button><button class="btn ghost" id="goTerms" style="flex:1">📖 용어집 ${TERMS.length}</button></div>`; }
  // 유형별 드릴
  html+=`<h2 class="section">📚 유형별 드릴 — 원리 → 드릴</h2>`;
  const groups=s==="RCT"?(META.rctQtypes||[]).map(k=>({key:k,ko:RCT_QTYPE_KO[k]||k,cnt:pool.filter(q=>q.qtype===k).length,wk:"RCT:"+k,note:notes.find(n=>n.key===k)}))
    :topicsOf(s).map(t=>({key:t.key,ko:t.ko,cnt:pool.filter(q=>q.topic===t.key).length,wk:s+":"+t.key,note:notes.find(n=>n.key===t.key)}));
  html+=groups.map(g=>`<details class="topic"><summary><div class="tn"><b>${esc(g.ko)}</b><span class="muted">${s==="RCT"?g.key:g.key} · 문항 ${g.cnt}</span></div>${topicAccHTML(g.wk)}</summary>
    <div class="tbody">${noteBody(g.note)}<div class="row mt12" style="gap:8px"><button class="btn sm primary" data-drill="${g.key}" style="flex:1" ${g.cnt?"":"disabled"}>해설 즉시 10문제</button>
      <button class="btn sm ghost" data-drill-timed="${g.key}" style="flex:1" ${g.cnt?"":"disabled"}>시간 제한 10문제</button></div></div></details>`).join("");
  if(s==="RCT"){ const tps=topicsOf("RCT").filter(t=>pool.some(q=>q.topic===t.key));
    html+=`<div class="muted small" style="margin:10px 2px 6px">지문 주제로 골라 풀기</div><div class="filters">${tps.map(t=>`<button class="chip" data-ptopic="${t.key}">${esc(t.ko)}</button>`).join("")}</div>`; }
  // 고정 SET
  const sets=bankSets(s);
  if(sets.length){ const done=sets.filter((_,i)=>state.exams[`set:${s}:${i+1}`]).length;
    html+=`<h2 class="section">🧩 실전 SET (고정 문항 · 시간 제한)</h2><details class="math-bank-group" ${done<sets.length?"open":""}><summary><div class="math-bank-summary"><b>${s} SET ${sets.length}개</b><span>${SET_SIZE}문항 · ${fmtTime(SET_SIZE*SECRATE[s])} · 응시 ${done}/${sets.length}</span></div></summary>
      <div class="math-bank-grid">${sets.map((ids,i)=>{ const k=`set:${s}:${i+1}`, ex=state.exams[k];
        return `<button class="math-bank-set ${ex?"done":""}" data-exam="${k}"><span class="math-bank-set-top"><b>SET ${String(i+1).padStart(2,"0")}</b>${ex?"<i>✓</i>":""}</span>
          <span>${ids.length}문항</span>${ex?`<small>최고 ${ex.best}/${ex.bestTotal} · 최근 ${ex.last}/${ex.lastTotal}</small>`:"<small>미응시</small>"}</button>`; }).join("")}</div></details>`; }
  html+=`<div class="row mt16" style="gap:8px"><button class="btn ghost" id="goBrowse" style="flex:1">👀 문제 훑어보기</button><button class="btn ghost" id="goGuide" style="flex:1">📘 공부 가이드</button></div>`;
  if(!pool.length) html+=`<div class="hintbox mt12">문제은행이 아직 비어 있어요. 데이터가 추가되면 여기서 풀 수 있어요.</div>`;
  $("#subBody").innerHTML=html;
  const B=$("#subBody");
  $$("[data-exam]",B).forEach(b=>b.onclick=()=>startExam(b.dataset.exam,{from:"sub:"+s}));
  $$("[data-exam-practice]",B).forEach(b=>b.onclick=()=>startExam(b.dataset.examPractice,{practice:true,from:"sub:"+s}));
  $$("[data-wrongsub]",B).forEach(b=>b.onclick=()=>{ wrongCtx={tab:s}; go("wrong"); });
  const lbl=k=>s==="RCT"?(RCT_QTYPE_KO[k]||k):topicKo(s,k), key=k=>s==="RCT"?{qtype:k}:{topic:k};
  $$("[data-drill]",B).forEach(b=>b.onclick=()=>startDrill(s,{...key(b.dataset.drill),n:10,label:`${s} 드릴: ${lbl(b.dataset.drill)}`,from:"sub:"+s}));
  $$("[data-drill-timed]",B).forEach(b=>b.onclick=()=>startDrill(s,{...key(b.dataset.drillTimed),n:10,learn:false,label:`${s} 시간 제한: ${lbl(b.dataset.drillTimed)}`,from:"sub:"+s}));
  $$("[data-ptopic]",B).forEach(b=>b.onclick=()=>startDrill("RCT",{filter:q=>q.topic===b.dataset.ptopic,n:10,label:`RCT 지문: ${topicKo("RCT",b.dataset.ptopic)}`,from:"sub:RCT"}));
  $("#goBrowse").onclick=()=>{ browseCtx={sub:s,topic:"",q:"",limit:25}; go("browse"); };
  $("#goGuide").onclick=()=>openGuide(s.toLowerCase(),"sub:"+s);
  const gf=$("#goFlash"); if(gf) gf.onclick=()=>go("flash");
  const gt=$("#goTerms"); if(gt) gt.onclick=()=>{ termsCtx={cat:"",q:"",limit:40}; go("terms"); };
}

/* ---------- browse ---------- */
function renderBrowse(){
  const c=browseCtx, s=c.sub, isR=s==="RCT";
  $("#browseTitle").textContent=`👀 ${s} 훑어보기`;
  $("#browseBack").onclick=()=>go("sub:"+s);
  const keys=isR?(META.rctQtypes||[]):topicsOf(s).map(t=>t.key);
  $("#browseFilters").innerHTML=`<button class="chip ${c.topic?"":"on"}" data-t="">전체</button>`+keys.map(k=>`<button class="chip ${c.topic===k?"on":""}" data-t="${k}">${esc(isR?(RCT_QTYPE_KO[k]||k):topicKo(s,k))}</button>`).join("");
  $$("#browseFilters .chip").forEach(b=>b.onclick=()=>{ c.topic=b.dataset.t; c.limit=25; renderBrowse(); });
  const q=c.q.trim().toLowerCase();
  const list=POOL[s].filter(x=>(!c.topic||(isR?x.qtype===c.topic:x.topic===c.topic))&&(!q||[x.q,x.q_ko,x.explain,x.title,x.passage,...x.options].join(" ").toLowerCase().includes(q)));
  $("#browseList").innerHTML=list.slice(0,c.limit).map(x=>{ const it=toItem(s,x);
    return `<div class="bcard"><div class="bh"><span>${esc(x.id)}</span><span>·</span><span>${esc(isR?(RCT_QTYPE_KO[x.qtype]||""):topicKo(s,x.topic))}</span><span class="dchip">${diffDots(x.diff)}</span>${state.wrongs[x.id]&&wrongActive(state.wrongs[x.id])?`<span class="rtag r${state.wrongs[x.id].reason||0}">오답</span>`:""}</div>
      ${isR?`<details class="ko-details"><summary>📖 ${esc(x.title)}</summary><div class="passage" style="font-size:14px;margin-top:6px">${esc(x.passage)}</div><details class="ko-details"><summary>한글 번역</summary><div class="kotxt">${esc(x.passage_ko)}</div></details></details>`:""}
      <div class="bq">${fmtMath(x.q)}</div>${!flag("hide_ko")&&x.q_ko?`<div class="bko">${fmtMath(x.q_ko)}</div>`:""}
      ${it.fig?`<div class="figbox">${renderFig(it.fig)}</div>`:""}
      <details><summary>보기·정답·해설</summary>${x.options.map((o,i)=>`<div class="bo ${i===x.answer?"ok":""}">${i===x.answer?"✓ ":""}${i+1}. ${fmtMath(o)}</div>`).join("")}<div class="bx">${fmtMath(x.explain)}</div></details></div>`; }).join("")
    ||`<div class="card muted center">조건에 맞는 문제가 없어요.</div>`;
  $("#browseMore").classList.toggle("hidden",list.length<=c.limit);
  $("#browseMore").onclick=()=>{ c.limit+=25; renderBrowse(); };
}

/* ---------- glossary ---------- */
function renderTerms(){
  const c=termsCtx, cats=topicsOf("ANIT").filter(t=>TERMS.some(x=>x.category===t.key));
  $("#termsCount").textContent=`${TERMS.length}개`;
  $("#termsFilters").innerHTML=`<button class="chip ${c.cat?"":"on"}" data-c="">전체</button><button class="chip ${c.cat==="@naval"?"on":""}" data-c="@naval">⚓ 해상 전체</button>`+
    cats.map(t=>`<button class="chip ${c.cat===t.key?"on":""}" data-c="${t.key}">${esc(t.ko)}</button>`).join("");
  $$("#termsFilters .chip").forEach(b=>b.onclick=()=>{ c.cat=b.dataset.c; c.limit=40; renderTerms(); });
  const q=c.q.trim().toLowerCase();
  const list=TERMS.filter(t=>(!c.cat||(c.cat==="@naval"?NAVAL_TOPICS.has(t.category):t.category===c.cat))&&(!q||[t.term,t.ko,t.def,t.def_ko].join(" ").toLowerCase().includes(q)));
  $("#termsList").innerHTML=list.slice(0,c.limit).map(t=>{ const cd=state.terms[t.id];
    return `<div class="avterm"><div class="t">${esc(t.term)}</div><div class="ko">${esc(t.ko)}</div><div class="d">${esc(t.def)}</div><div class="de">${esc(t.def_ko)}</div>
      <span class="cat">${esc(topicKo("ANIT",t.category))}</span>${cd&&cd.status!=="new"?` <span class="cat">${cd.status==="mastered"?"마스터":"학습 중 · "+fmtIv(cd.interval)}</span>`:""}</div>`; }).join("")
    ||`<div class="card muted center">용어가 없어요.</div>`;
  $("#termsMore").classList.toggle("hidden",list.length<=c.limit); $("#termsMore").onclick=()=>{ c.limit+=40; renderTerms(); };
}

/* ---------- flashcards (SM-2) ---------- */
function buildFlashQueue(){
  const now=Date.now(), due=TERMS.filter(t=>termDue(state.terms[t.id],now)).sort((a,b)=>new Date(state.terms[a.id].due)-new Date(state.terms[b.id].due));
  const room=Math.max(0,(+state.settings.terms_per_day||0)-todayStat("termsNew"));
  const fresh=TERMS.filter(t=>!state.terms[t.id]||state.terms[t.id].status==="new")
    .sort((a,b)=>(NAVAL_TOPICS.has(b.category)-NAVAL_TOPICS.has(a.category))||a.id.localeCompare(b.id)).slice(0,room);
  return [...due,...fresh].map(t=>t.id);
}
function renderFlash(){
  if(!flashSes) flashSes={queue:buildFlashQueue(),done:0,flipped:false,again:new Set()};
  const f=flashSes, area=$("#flashArea");
  $("#flashBack").onclick=()=>{ flashSes=null; go("sub:ANIT"); };
  if(!f.queue.length){ $("#flashCount").textContent="";
    area.innerHTML=`<div class="card center"><div class="big-emoji">🎉</div><b>오늘 카드 끝!</b><div class="muted" style="font-size:12.5px;margin-top:6px">오늘 ${todayStat("terms")}장 · 신규 ${todayStat("termsNew")}장. 복습은 내일 다시 떠요.</div>
      <button class="btn ghost mt12" id="flashMore">➕ 신규 10장 더</button></div>`;
    $("#flashMore").onclick=()=>{ const ids=TERMS.filter(t=>!state.terms[t.id]||state.terms[t.id].status==="new").sort((a,b)=>(NAVAL_TOPICS.has(b.category)-NAVAL_TOPICS.has(a.category))||a.id.localeCompare(b.id)).slice(0,10).map(t=>t.id);
      if(!ids.length) return toast("새 카드가 없어요 👍"); f.queue=ids; renderFlash(); };
    return; }
  const t=TERM_INDEX.get(f.queue[0]); if(!t){ f.queue.shift(); return renderFlash(); }
  $("#flashCount").textContent=`남은 카드 ${f.queue.length} · 오늘 ${todayStat("terms")}`;
  const c=getTerm(t.id);
  area.innerHTML=`<div class="avflash" id="flashCard">${!f.flipped?`<div class="ft">${esc(t.term)}</div><div class="fc">${esc(topicKo("ANIT",t.category))}${c.status==="new"?" · 🆕":""} — 탭해서 뒤집기</div>`
      :`<div class="fko">${esc(t.ko)}</div><div class="ft" style="font-size:18px">${esc(t.term)}</div><div class="fd">${esc(t.def)}</div><div class="fde">${esc(t.def_ko)}</div>`}</div>
    ${f.flipped?`<div class="grade">${[["again","다시","g-again"],["hard","어려움","g-hard"],["good","좋음","g-good"],["easy","쉬움","g-easy"]].map(([q,l,cls],i)=>
      `<button class="${cls}" data-q="${q}">${l}<small>${q==="again"?"<1일":fmtIv(predictTerm(t.id,q))} · ${i+1}</small></button>`).join("")}</div>`
      :`<button class="btn primary mt12" id="flipBtn">뒤집기 (Space)</button>`}`;
  $("#flashCard").onclick=()=>{ f.flipped=!f.flipped; renderFlash(); };
  const fb=$("#flipBtn"); if(fb) fb.onclick=()=>{ f.flipped=true; renderFlash(); };
  $$("#flashArea .grade button").forEach(b=>b.onclick=()=>gradeFlash(b.dataset.q));
}
function gradeFlash(q){ const f=flashSes; if(!f||!f.queue.length||!f.flipped) return; const id=f.queue.shift();
  gradeTerm(id,q); f.done++; f.flipped=false;
  if(q==="again"){ f.queue.splice(Math.min(3,f.queue.length),0,id); }     // 몇 장 뒤 다시
  bumpDay({studied:0}); renderFlash(); }

/* ---------- mock setup ---------- */
let pickSel=new Set();
function renderMock(){
  const snap=loadExamSnap(), box=$("#examResumeBox");
  if(snap){ const done=(snap.answers||[]).filter(a=>a!=null).length; box.classList.remove("hidden");
    box.innerHTML=`<div class="card math-bank-resume"><b>⏸ 하다 만 시험 — ${esc(snap.name)}</b><div class="muted" style="font-size:12.5px;margin-top:4px">${done}/${snap.total}문항 · ${snap.timerAt?"앱이 닫힌 동안 시간이 흘렀을 수 있어요":"시계 멈춤 상태"}</div>
      <div class="row"><button class="btn primary" id="resumeBtn">이어서 풀기</button><button class="btn ghost" id="dropBtn">버리기</button></div></div>`;
    $("#resumeBtn").onclick=resumeExamSnap; $("#dropBtn").onclick=()=>{ if(confirm("하다 만 시험을 버릴까요?")){ clearExamSnap(); renderMock(); } }; }
  else box.classList.add("hidden");
  $("#optNoBack").checked=flag("no_back"); $("#optShowKo").checked=!flag("hide_ko");
  const preset=k=>{ const p=EXAM_PRESETS[k]; if(!p) return ""; const ex=state.exams[k];
    return `<button class="exam-preset" data-exam="${k}" ${k==="full"||k==="oar"?'style="border-color:var(--gold)"':""}><div class="ic">${p.icon}</div><div class="meta"><b>${esc(p.name)}</b><div class="muted">${esc(p.desc)}</div>
      ${ex?`<div class="last">최근 ${ex.last}/${ex.lastTotal} · 최고 ${ex.best}/${ex.bestTotal} · ${fmtDate(ex.date)}</div>`:""}</div><div class="go">›</div></button>`; };
  const forms=Object.keys(MOCKS).map(L=>preset("form_"+L)).join("");
  $("#mockPresets").innerHTML=`<h3 class="exam-group">🏆 종합 모의고사 (덜 본 문제로 새로 구성)</h3>${preset("oar")}${preset("full")}${preset("diag")}
    ${forms?`<h3 class="exam-group">📘 고정 모의고사 — 같은 문항으로 재응시 비교</h3>${forms}`:""}
    <h3 class="exam-group">📚 과목별 실전</h3>${SUBS.map(s=>preset("sub:"+s)).join("")}`;
  $$("#mockPresets [data-exam]").forEach(b=>b.onclick=()=>startExam(b.dataset.exam,{from:"mock"}));
  $("#pickSecs").innerHTML=SUBS.map(s=>`<button class="pick-chip ${pickSel.has(s)?"on":""}" data-s="${s}"><span class="pi">${SUBMETA[s].icon}</span><b>${s}</b><span class="pm">${SUBMETA[s].n}문항 · ${SUBMETA[s].secs/60}분</span></button>`).join("");
  $$("#pickSecs .pick-chip").forEach(b=>b.onclick=()=>{ const s=b.dataset.s; if(pickSel.has(s)) pickSel.delete(s); else pickSel.add(s); renderMock(); });
  const sel=SUBS.filter(s=>pickSel.has(s));
  $("#pickSum").textContent=sel.length?`${sel.join(" → ")} · ${sel.reduce((t,s)=>t+SUBMETA[s].n,0)}문항 · ${sel.reduce((t,s)=>t+SUBMETA[s].secs,0)/60}분`:"과목을 선택하세요";
  $("#pickStart").disabled=!sel.length; $("#pickStart").onclick=()=>startPicked(sel);
  const due=dueWrongs().length, all=activeWrongs().length;
  $("#mockWrong").innerHTML=`<div class="card"><div class="row" style="justify-content:space-between;align-items:center"><div><b>오답 ${all}문제</b><div class="muted" style="font-size:12px">오늘 다시 볼 문제 ${due} · ${SUBS.map(s=>`${s} ${activeWrongs(s).length}`).join(" · ")}</div></div></div>
    <div class="row mt12" style="gap:8px"><button class="btn primary" id="mwDue" style="flex:1" ${due?"":"disabled"}>▶ 오늘 다시 볼 ${due}</button><button class="btn ghost" id="mwOpen" style="flex:1">📕 오답노트 열기</button></div></div>`;
  $("#mwDue").onclick=()=>startWrongReview({due:true}); $("#mwOpen").onclick=()=>{ wrongCtx={tab:"due"}; go("wrong"); };
}

/* ---------- wrong notebook ---------- */
function reasonCounts(sinceDay){ const c={1:0,2:0,3:0,4:0}; for(const x of state.reasonLog) if(!sinceDay||x.d>=sinceDay) c[x.r]=(c[x.r]||0)+1; return c; }
function renderWrong(){
  const c=wrongCtx, all=activeWrongs(), due=dueWrongs();
  const tabs=[["due",`오늘 다시 볼 ${due.length}`],["all",`전체 ${all.length}`],...SUBS.map(s=>[s,`${s} ${activeWrongs(s).length}`])];
  let list=c.tab==="due"?due:c.tab==="all"?all:activeWrongs(c.tab);
  list=list.sort((a,b)=>(a[1].next||"").localeCompare(b[1].next||"")||SUBS.indexOf(a[1].s)-SUBS.indexOf(b[1].s));
  const rc=reasonCounts(addDays(todayStr(),-13)), ra=reasonCounts(), untagged=all.filter(([,w])=>!w.reason).length;
  const sub=SUBS.includes(c.tab)?c.tab:null;
  let html=`<div class="filters">${tabs.map(([k,l])=>`<button class="chip ${c.tab===k?"on":""}" data-tab="${k}">${l}</button>`).join("")}</div>
    <div class="card tight"><div style="font-weight:700;font-size:13px;margin-bottom:6px">틀린 이유 (최근 2주 / 전체) · 미분류 ${untagged}</div>
      ${[1,2,3,4].map(r=>`<div class="rep-row"><div class="lab"><span><span class="rtag r${r}">${"①②③④"[r-1]}</span> ${REASONS[r]} <span class="muted">→ ${REASON_FIX[r]}</span></span><span>${rc[r]} / ${ra[r]}</span></div>
        <div class="progressbar mini"><i style="width:${Math.min(100,(ra[r]||0)/Math.max(1,Math.max(...Object.values(ra)))*100)}%"></i></div></div>`).join("")}</div>
    <div class="row mt12" style="gap:8px"><button class="btn primary" id="wrDo" style="flex:1" ${list.length?"":"disabled"}>▶ ${c.tab==="due"?"오늘 문제":"이 목록"} 다시 풀기 (해설 즉시)</button>
      <button class="btn ghost" id="wrTimed" style="flex:1" ${list.length?"":"disabled"}>⏱ 시간 재고 재시험</button></div>
    <h2 class="section">${list.length}문제</h2>`;
  html+=list.slice(0,80).map(([id,w])=>{ const it=itemById(id); if(!it) return "";
    const due=!w.next||w.next<=todayStr();
    return `<div class="wn-item"><div class="wh"><span>${it.section} · ${esc(it.section==="RCT"?(RCT_QTYPE_KO[it.qtype]||""):topicKo(it.section,it.topic))}</span><span>· ${w.n}회 틀림</span>
        ${due?`<span class="due-badge">오늘</span>`:`<span>· 다음 ${fmtDate(w.next)}</span>`}${w.streak?`<span>· 연속 정답 ${w.streak}/2</span>`:""}</div>
      ${it.section==="RCT"?`<div class="muted small" style="margin-bottom:4px">📖 ${esc(it.title)}</div>`:""}<div class="wq">${fmtMath(it.prompt)}</div>
      ${it.fig?`<div class="figbox">${renderFig(it.fig)}</div>`:""}<div class="wa">정답: ${it.answer+1}. ${fmtMath(it.options[it.answer])}</div>
      <details><summary>해설${it.section==="RCT"?"·지문":""}</summary>${it.section==="RCT"?`<div class="passage" style="font-size:13.5px;margin-top:6px">${esc(it.passage)}</div>`:""}<div class="wx">${fmtMath(it.explain)}</div></details>
      ${reasonHTML(id)}</div>`; }).join("")||`<div class="card center muted">${c.tab==="due"?"오늘 다시 볼 오답이 없어요 👍":"오답이 없어요 👍"}</div>`;
  $("#wrongBody").innerHTML=html;
  $$("#wrongBody [data-tab]").forEach(b=>b.onclick=()=>{ wrongCtx={tab:b.dataset.tab}; renderWrong(); });
  $("#wrDo").onclick=()=>startWrongReview({due:c.tab==="due",sub});
  $("#wrTimed").onclick=()=>startWrongReview({due:c.tab==="due",sub,timed:true});
  $("#wrongBack").onclick=()=>go("mock");
}

/* ---------- stats ---------- */
function trendSVG(points){ // points: [{x:label,y:value}]
  const W=340,H=150,L=30,R=10,Tp=12,B=24, ys=points.map(p=>p.y), lo=Math.min(30,...ys)-2, hi=Math.max(70,...ys)+2;
  const X=i=>L+(points.length<2?0:i*(W-L-R)/(points.length-1)), Y=v=>Tp+(hi-v)/(hi-lo)*(H-Tp-B);
  let g=""; for(const v of [30,40,50,60,70]) if(v>lo&&v<hi) g+=`<line x1="${L}" x2="${W-R}" y1="${Y(v)}" y2="${Y(v)}" class="${v===TARGET_OAR?"tl":"gl"}"/><text x="${L-6}" y="${Y(v)+3}" text-anchor="end">${v}</text>`;
  g+=`<polyline points="${points.map((p,i)=>`${X(i)},${Y(p.y)}`).join(" ")}" class="pl"/>`+points.map((p,i)=>`<circle cx="${X(i)}" cy="${Y(p.y)}" r="3.5"/>`).join("");
  g+=points.map((p,i)=>(points.length<=8||i%Math.ceil(points.length/8)===0)?`<text x="${X(i)}" y="${H-6}" text-anchor="middle">${esc(p.x)}</text>`:"").join("");
  return `<svg class="trend" viewBox="0 0 ${W} ${H}" role="img" aria-label="예상 OAR 추이">${g}</svg>`; }
function renderStats(){
  const today=todayStr(), streak=computeStreak();
  const totals=Object.values(state.secAcc).reduce((t,o)=>({c:t.c+(o.c||0),n:t.n+(o.c||0)+(o.w||0)}),{c:0,n:0});
  const secs=Object.values(state.daily).reduce((t,d)=>t+(d.seconds||0),0);
  // 달력: 최근 12주
  const start=addDays(today,-(7*11+new Date().getDay())); let cal=["일","월","화","수","목","금","토"].map(d=>`<div class="d dow">${d}</div>`).join("");
  for(let i=0;i<7*12;i++){ const day=addDays(start,i); if(day>today){ cal+=`<div class="d" style="opacity:.25"></div>`; continue; }
    const r=state.daily[day], n=r?(r.studied||0):0, cls=(r&&r.goal_met)||n>=DAILY_MIN?"met":n>=10?"lv2":n>0?"lv1":"";
    cal+=`<div class="d ${cls} ${day===today?"today":""}" title="${day} · ${n}문제">${parseDate(day).getDate()}</div>`; }
  const est=estOAR();
  const subRows=SUBS.map(s=>{ const a=subtestAcc(s), r=readiness(s), f5=first5Acc(s), sp=state.speed[s];
    return `<div class="rep-row"><div class="lab"><span><b>${s}</b> ${SUBMETA[s].ko}</span><span>${a?Math.round(a.acc*100)+"%":"–"} <span class="muted">· 준비도 ${r!=null?r:"–"}${a?` · n=${a.n}`:""}</span></span></div>
      <div class="progressbar mini"><i style="width:${r||0}%"></i></div>
      <div class="muted" style="font-size:11px;margin-top:3px">초반 5문제 ${f5!=null?Math.round(f5*100)+"%":"–"} · 평균 ${sp&&sp.n?Math.round(sp.ms/sp.n/1000)+"초":"–"}/${SECRATE[s]}초${sp&&sp.slow?` · 느림 ${sp.slow}`:""}</div></div>`; }).join("");
  const pts=realExams().filter(h=>h.oar!=null).slice(-16).map(h=>({x:fmtDate(h.date),y:h.oar}));
  // 약점 TOP (유형별, 4문항 이상)
  const weak=Object.entries(state.weak.topic).map(([k,v])=>({k,n:v.c+v.w,acc:v.c/Math.max(1,v.c+v.w)})).filter(x=>x.n>=4).sort((a,b)=>a.acc-b.acc).slice(0,8);
  const rc=reasonCounts(addDays(today,-13)), ra=reasonCounts();
  const pbm=(state.pbmLog||[]).filter(x=>!x.del).sort((a,b)=>b.date.localeCompare(a.date));
  const real=(state.realScores||[]).filter(x=>!x.del).sort((a,b)=>b.date.localeCompare(a.date));
  $("#statsBody").innerHTML=`<h2 class="section" style="margin-top:0">📅 학습 달력 (최근 12주)</h2>
    <div class="card"><div class="cal">${cal}</div><div class="grid3 mt12"><div class="stat"><div class="num">${streak}</div><div class="lbl">🔥 연속</div></div>
      <div class="stat"><div class="num">${totals.n}</div><div class="lbl">누적 풀이 · ${pctOf(totals.c,totals.n)}%</div></div><div class="stat"><div class="num">${Math.round(secs/3600*10)/10}</div><div class="lbl">시험 시간(h)</div></div></div></div>
    <h2 class="section">🎯 예상 점수 (비공식)</h2>
    <div class="card"><div class="rep-hero" style="margin-bottom:10px"><div class="muted" style="font-size:12px">예상 OAR (MST·RCT·MCT)</div><div class="big">${est.oar!=null?`${est.oar} <span class="muted" style="font-size:14px">/ 80 · 목표 ${TARGET_OAR}+</span>`:`— <span class="muted" style="font-size:13px">${est.missing.join("·")} 진단 필요</span>`}</div></div>
      ${subRows}
      <div class="hintbox mt12">AQR · PFAR · FOFAR (스타나인 1–9, 목표 각 ${TARGET_COMPOSITE}) — PBM·NATFI 반영이라 이 앱에선 추정하지 않아요. 실제 점수는 아래 '실전 점수'에 기록하세요.</div>
      <div class="note-oar">${OAR_NOTE}</div></div>
    <h2 class="section">📈 예상 OAR 추이</h2>
    <div class="card">${pts.length>=2?trendSVG(pts):`<div class="muted center small">OAR 3과목이 모두 들어간 모의고사를 2회 이상 보면 그래프가 그려져요.</div>`}</div>
    <h2 class="section">🧩 약점 유형</h2>
    <div class="card">${weak.length?weak.map(w=>{ const [s,key]=w.k.split(":"); return `<div class="rep-rec"><div class="meta"><b>${s} · ${esc(weakLabel(w.k))}</b><div class="muted">${Math.round(w.acc*100)}% · ${w.n}문항</div></div>
        <button class="btn primary" data-wdrill="${esc(w.k)}">드릴</button></div>`; }).join(""):`<div class="rep-empty">유형별로 4문항 이상 풀면 약점이 보여요.</div>`}</div>
    <h2 class="section">📕 틀린 이유 (최근 2주 / 전체)</h2>
    <div class="card">${[1,2,3,4].map(r=>`<div class="rep-row"><div class="lab"><span><span class="rtag r${r}">${"①②③④"[r-1]}</span> ${REASONS[r]}</span><span>${rc[r]} / ${ra[r]}</span></div><div class="progressbar mini"><i style="width:${Math.min(100,ra[r]/Math.max(1,...Object.values(ra))*100)}%"></i></div></div>`).join("")}
      <div class="muted" style="font-size:11.5px;margin-top:8px">① → 유형 노트로 원리 · ②③ → 드릴 · ④ → 시간 제한 SET. 응시 기준: 최근 2주 ① 0건.</div></div>
    <h2 class="section" id="pbmForm">🕹️ PBM 연습 기록 (${pbm.length}/10)</h2>
    <div class="card"><div class="muted" style="font-size:12px">HOTAS(조이스틱+스로틀)로 추적·청취·비상 대응 연습 후 기록. PBM 시뮬레이터는 2단계에서 추가 예정.</div>
      <div class="formgrid"><label>날짜<input type="date" id="pbDate" value="${today}"></label><label>분<input type="number" id="pbMin" value="30" min="5" step="5"></label>
        <label>자기평가 (1–5)<select id="pbRate">${[1,2,3,4,5].map(n=>`<option ${n===3?"selected":""}>${n}</option>`).join("")}</select></label><label>놓친 신호<input type="number" id="pbMiss" value="0" min="0"></label></div>
      <div class="field" style="margin-top:8px"><input id="pbMemo" placeholder="메모 (예: 청취 과제 추가, 추적 흔들림)"></div>
      <button class="btn primary mt8" id="pbAdd">➕ 세션 기록</button>
      <div class="mt12">${pbm.slice(0,12).map(x=>`<div class="logrow"><div class="grow"><b>${fmtDate(x.date)}</b> · ${x.min}분 · 평가 ${x.rate} · 놓침 ${x.miss}${x.memo?`<div class="muted small">${esc(x.memo)}</div>`:""}</div><button class="x" data-delpbm="${esc(x.id)}">×</button></div>`).join("")}</div></div>
    <h2 class="section">🏅 실전 점수 기록</h2>
    <div class="card"><div class="formgrid"><label>날짜<input type="date" id="rsDate" value="${today}"></label><label>OAR<input type="number" id="rsOar" min="20" max="80"></label>
        <label>AQR<input type="number" id="rsAqr" min="1" max="9"></label><label>PFAR<input type="number" id="rsPfar" min="1" max="9"></label><label>FOFAR<input type="number" id="rsFofar" min="1" max="9"></label></div>
      <div class="field" style="margin-top:8px"><input id="rsMemo" placeholder="메모 (응시 차수·장소 등)"></div>
      <button class="btn ghost mt8" id="rsAdd">➕ 점수 기록</button>
      <div class="mt12">${real.map(x=>`<div class="logrow"><div class="grow"><b>${x.date}</b> · OAR ${x.oar??"–"} · AQR ${x.aqr??"–"} · PFAR ${x.pfar??"–"} · FOFAR ${x.fofar??"–"}${x.memo?`<div class="muted small">${esc(x.memo)}</div>`:""}</div><button class="x" data-delrs="${esc(x.id)}">×</button></div>`).join("")||`<div class="muted small">평생 3회 · 최신 점수가 이전 점수를 대체해요.</div>`}</div></div>
    <button class="btn ghost mt16" id="goExamLog">🗂️ 지난 시험 기록 (${state.examHist.length})</button>`;
  $$("#statsBody [data-wdrill]").forEach(b=>b.onclick=()=>{ const [s,key]=b.dataset.wdrill.split(":"); startDrill(s,{...(s==="RCT"?{qtype:key}:{topic:key}),n:10,label:`약점: ${weakLabel(b.dataset.wdrill)}`,from:"stats"}); });
  $("#pbAdd").onclick=()=>{ const date=$("#pbDate").value||today; state.pbmLog.push({id:"p"+Date.now(),date,min:+$("#pbMin").value||30,rate:+$("#pbRate").value||3,miss:+$("#pbMiss").value||0,memo:$("#pbMemo").value.trim()});
    saveLocal(); toast("🕹️ PBM 세션 기록"); renderStats(); };
  $$("#statsBody [data-delpbm]").forEach(b=>b.onclick=()=>{ const x=state.pbmLog.find(p=>p.id===b.dataset.delpbm); if(x&&confirm("이 PBM 기록을 지울까요?")){ x.del=1; saveLocal(); renderStats(); } });
  $("#rsAdd").onclick=()=>{ const v=id=>{ const n=$(id).value; return n===""?null:+n; }; const e={id:"r"+Date.now(),date:$("#rsDate").value||today,oar:v("#rsOar"),aqr:v("#rsAqr"),pfar:v("#rsPfar"),fofar:v("#rsFofar"),memo:$("#rsMemo").value.trim()};
    if([e.oar,e.aqr,e.pfar,e.fofar].every(x=>x==null)) return toast("점수를 하나 이상 입력하세요"); state.realScores.push(e); saveLocal(); toast("🏅 점수 기록"); renderStats(); };
  $$("#statsBody [data-delrs]").forEach(b=>b.onclick=()=>{ const x=state.realScores.find(p=>p.id===b.dataset.delrs); if(x&&confirm("이 점수 기록을 지울까요?")){ x.del=1; saveLocal(); renderStats(); } });
  $("#goExamLog").onclick=()=>{ examlogOpen=null; go("examlog"); };
}

/* ---------- exam log ---------- */
function renderExamLog(){
  $("#examlogBack").onclick=()=>{ if(examlogOpen!=null){ examlogOpen=null; renderExamLog(); } else go("stats"); };
  const H=state.examHist;
  if(examlogOpen!=null){ const h=H.find(x=>x.ts===examlogOpen); if(!h){ examlogOpen=null; return renderExamLog(); }
    const items=(h.items||[]);
    $("#examlogBody").innerHTML=`<div class="card"><b>${esc(h.name)}</b><div class="muted small">${h.date} · ${h.got}/${h.total} (${Math.round(h.acc*100)}%)${h.oar!=null?` · 예상 OAR ${h.oar}`:""} · ${fmtTime(h.secs||0)}</div>
      <div class="muted small mt8">${Object.entries(h.bySec||{}).map(([k,v])=>`${k} ${v.got}/${v.total}`).join(" · ")}${h.f5?` · 초반5 ${Object.entries(h.f5).map(([k,v])=>`${k} ${v[0]}/${v[1]}`).join(" ")}`:""}</div></div>
      ${items.length?items.map((x,i)=>reviewItemHTML(itemById(x.id),x.u,i+1,x.ms)).join(""):`<div class="card muted center mt12">이 기록은 요약만 남아 있어요 (상세는 최근 20회만 이 기기에 보관).</div>`}`;
    return; }
  $("#examlogBody").innerHTML=[...H].reverse().map(h=>`<button class="elrow" data-ts="${h.ts}"><div class="elm"><div class="eln">${esc(h.name)}${h.learn?" · 학습":h.practice?" · 연습":""}</div>
      <div class="eld">${h.date} · ${Object.entries(h.bySec||{}).map(([k,v])=>`${k} ${v.got}/${v.total}`).join(" · ")}</div></div>
      <div class="elsc"><b>${h.oar!=null?h.oar:Math.round(h.acc*100)+"%"}</b><span>${h.oar!=null?"OAR":`${h.got}/${h.total}`}</span></div><div class="elgo">›</div></button>`).join("")
    ||`<div class="card muted center">아직 기록이 없어요.</div>`;
  $$("#examlogBody .elrow").forEach(b=>b.onclick=()=>{ examlogOpen=+b.dataset.ts; renderExamLog(); window.scrollTo(0,0); });
}

/* ---------- guide ---------- */
function renderGuide(){
  const g=GUIDES[guideCur];
  $("#guideBack").onclick=()=>go(guideBack||"home");
  if(!g){ $("#guideBody").innerHTML=`<div class="card center muted" style="padding:20px">가이드 준비 중이에요.</div>`; return; }
  $("#guideBody").innerHTML=`<div class="guide-hero"><h2>${esc(g.title)}</h2><div class="fmt">📋 ${fmtMath(g.format||"")}</div></div>`+
    (g.sections||[]).map(s=>`<div class="guide-sec"><h3>${esc(s.h)}</h3><p>${fmtMath(s.body)}</p></div>`).join("")+
    ((g.tips&&g.tips.length)?`<div class="guide-tips"><h3>⚡ 빠른 팁</h3><ul>${g.tips.map(t=>`<li>${fmtMath(t)}</li>`).join("")}</ul></div>`:"")+
    ((g.sources&&g.sources.length)?`<div class="guide-src"><b>참고:</b> ${g.sources.map(esc).join(" · ")}</div>`:"");
}

/* ---------- settings ---------- */
function openSettings(){
  const s=state.settings;
  $("#setExam").value=s.exam_date||""; $("#setPhase").value=String(+s.phase||0); $("#setP2Start").value=s.p2start||""; $("#setTermsDay").value=s.terms_per_day;
  $("#syncCodeView").textContent=boundSyncCode(); $("#setUrl").value=localStorage.getItem(LS.url)||""; $("#setKey").value=localStorage.getItem(LS.key)||"";
  $("#verLine").textContent=`ASTB-E Prep v${VERSION} · 문항 ${SUBS.map(x=>`${x} ${POOL[x].length}`).join(" · ")} · 용어 ${TERMS.length}`;
  setSyncDot(sb?(syncReady?"on":"syncing"):"off"); if(sb&&!syncReady) setSyncDot("err");
  openSheet("settingsSheet");
}
function saveSettings(){
  const s=state.settings, prevPhase=+s.phase||0;
  s.exam_date=$("#setExam").value||""; s.phase=+$("#setPhase").value||0; s.p2start=$("#setP2Start").value||""; s.terms_per_day=clamp(+$("#setTermsDay").value||0,0,100);
  if(s.phase===2&&!s.p2start&&prevPhase!==2) s.p2start=todayStr();
  const url=$("#setUrl").value.trim(), key=$("#setKey").value.trim(), changedSb=url!==(localStorage.getItem(LS.url)||"")||key!==(localStorage.getItem(LS.key)||"");
  if(url) localStorage.setItem(LS.url,url); else localStorage.removeItem(LS.url);
  if(key) localStorage.setItem(LS.key,key); else localStorage.removeItem(LS.key);
  saveNow(); if(typeof queuePush==="function") queuePush("settings",{});
  closeSheet("settingsSheet"); toast("저장했어요");
  if(changedSb){ saveNow(); location.reload(); return; }
  softRender();
}
function switchSyncCode(code){
  if(!code) return; code=code.trim(); if(code===boundSyncCode()) return toast("같은 코드예요");
  if(!/^[A-Za-z0-9_-]{6,64}$/.test(code)) return toast("코드 형식이 올바르지 않아요");
  saveNow(); localStorage.setItem(LS.code,code); suppressPersistence=true;
  // 새 계정의 데이터를 서버에서 받아와야 하므로 로컬 진도를 비우고 다시 시작한다(백업 권장).
  localStorage.removeItem(LS.state); clearExamSnap(); location.reload();
}

/* ---------- backup / restore ---------- */
function exportProgress(){
  saveNow(); const blob=new Blob([JSON.stringify({app:"astb-prep",v:1,exportedAt:nowISO(),state},null,1)],{type:"application/json"});
  const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=`astb-progress-${todayStr()}.json`; document.body.appendChild(a); a.click();
  setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },500); toast("⬇️ 진도 파일을 저장했어요"); }
function importProgress(file){
  const rd=new FileReader(); rd.onload=()=>{ try{ const d=JSON.parse(rd.result); if(d.app!=="astb-prep"||!d.state) throw new Error("not astb");
      if(!confirm("이 파일의 진도로 이 기기의 진도를 덮어써요. 계속할까요?")) return;
      localStorage.setItem(LS.state,JSON.stringify(d.state)); suppressPersistence=true; location.reload(); }
    catch{ toast("ASTB-E Prep 백업 파일이 아니에요"); } }; rd.readAsText(file); }

/* ---------- onboarding ---------- */
function maybeOnboard(){
  if(state.settings.onboard_done) return;
  if((state.examHist||[]).length||Object.values(state.daily).some(d=>(d.studied||0)>0)){ state.settings.onboard_done=1; saveLocal(); return; }
  const ov=document.createElement("div"); ov.className="onboard-overlay";
  ov.innerHTML=`<div class="onboard-card"><div class="big-emoji">⚓</div><h2 style="margin:4px 0 2px">ASTB-E 준비, 3단계로 시작</h2><div class="muted" style="font-size:12.5px">1분이면 세팅 끝나요.</div>
    <div class="ob-step"><b>1️⃣ 응시 예정일</b><input type="date" id="obDate"><label style="display:flex;gap:6px;align-items:center;font-size:12.5px;margin-top:6px"><input type="checkbox" id="obUndecided" checked> 아직 미정 (졸업·WES 재평가 후 결정)</label></div>
    <div class="ob-step"><b>2️⃣ 지금 단계</b><div class="ob-phase">
      <label><input type="radio" name="obPh" value="0" checked><span><b>Phase 0 — 겸용</b><br><span class="muted">지금~졸업: AFOQT와 겹치는 수학·항공만 조금씩</span></span></label>
      <label><input type="radio" name="obPh" value="1"><span><b>Phase 1 — 진단 1주</b><br><span class="muted">졸업 직후 과목별 진단</span></span></label>
      <label><input type="radio" name="obPh" value="2"><span><b>Phase 2 — 집중 10주</b><br><span class="muted">MCT > PBM > ANIT(해상) > MST > RCT</span></span></label></div></div>
    <div class="ob-step"><b>3️⃣ 진단 미니 모의고사</b><div class="muted" style="font-size:12px;margin-top:4px">MST 10 · RCT 7 · MCT 10 · ANIT 10 · 약 34분 — 과목별 준비도와 예상 OAR이 채워져요.</div></div>
    <button class="btn primary mt12" id="obGo">저장하고 진단 시작</button><button class="btn ghost mt8" id="obLater">나중에 — 먼저 둘러보기</button></div>`;
  document.body.appendChild(ov);
  const save=()=>{ const s=state.settings; s.exam_date=$("#obUndecided").checked?"":($("#obDate").value||""); s.phase=+(($("input[name=obPh]:checked")||{}).value||0);
    if(s.phase===2&&!s.p2start) s.p2start=todayStr(); s.onboard_done=1; saveNow(); if(typeof queuePush==="function") queuePush("settings",{}); ov.remove(); };
  $("#obDate").oninput=()=>{ if($("#obDate").value) $("#obUndecided").checked=false; };
  $("#obGo").onclick=()=>{ save(); startExam("diag",{from:"home"}); };
  $("#obLater").onclick=()=>{ save(); renderHome(); };
}

/* ---------- wire ---------- */
function wire(){
  $$("#nav button[data-go]").forEach(b=>b.onclick=()=>go(b.dataset.go));
  const applyNav=()=>document.body.classList.toggle("nav-collapsed",localStorage.getItem(LS.nav)==="1");
  applyNav(); $("#navToggle").onclick=()=>{ localStorage.setItem(LS.nav,localStorage.getItem(LS.nav)==="1"?"0":"1"); applyNav(); $("#navToggle").textContent=document.body.classList.contains("nav-collapsed")?"▶":"◀"; };
  $("#navToggle").textContent=document.body.classList.contains("nav-collapsed")?"▶":"◀";
  $("#btnSettings").onclick=openSettings; $("#closeSettings").onclick=()=>closeSheet("settingsSheet"); $("#saveSettings").onclick=saveSettings;
  $("#settingsSheet").addEventListener("click",e=>{ if(e.target.id==="settingsSheet") closeSheet("settingsSheet"); });
  $("#copyCode").onclick=async()=>{ try{ await navigator.clipboard.writeText(boundSyncCode()); toast("📋 복사했어요"); }catch{ toast(boundSyncCode(),4000); } };
  $("#enterCode").onclick=()=>{ const c=prompt("다른 기기의 동기화 코드를 붙여넣으세요.\n(이 기기의 로컬 진도는 그 코드의 서버 데이터로 바뀌어요. 필요하면 먼저 백업!)"); if(c) switchSyncCode(c); };
  $("#newCode").onclick=()=>{ if(confirm("새 동기화 코드를 만들까요? 이 기기는 빈 계정으로 새로 시작해요(기존 코드의 서버 데이터는 그대로).")) switchSyncCode(genCode()); };
  $("#forceSync").onclick=forceSync;
  $("#exportProg").onclick=exportProgress; $("#importProg").onclick=()=>$("#importFile").click();
  $("#importFile").onchange=e=>{ const f=e.target.files&&e.target.files[0]; if(f) importProgress(f); e.target.value=""; };
  $("#forceUpdate").onclick=forceUpdate;
  $("#resetAll").onclick=()=>{ if(confirm("이 기기의 ASTB 학습 기록을 모두 지웁니다(서버 데이터·AFOQT 앱은 그대로). 계속할까요?")){ suppressPersistence=true; localStorage.removeItem(LS.state); clearExamSnap(); location.reload(); } };
  // home
  $("#btnToday").onclick=()=>{ const t=planTasks().find(x=>!taskDone(x)); if(t) t.act(); else { toast("오늘 할 일 완료! 🎉"); go("plan"); } };
  $("#btnHomeMock").onclick=()=>go("mock"); $("#btnHomeWrong").onclick=()=>{ wrongCtx={tab:"due"}; go("wrong"); };
  // mock toggles
  $("#optNoBack").onchange=e=>{ state.settings.no_back=e.target.checked; saveLocal(); queuePush("settings",{}); };
  $("#optShowKo").onchange=e=>{ state.settings.hide_ko=!e.target.checked; saveLocal(); queuePush("settings",{}); };
  // exam
  $("#examPrev").onclick=examPrevAction; $("#examNext").onclick=examNextAction; $("#examSubmit").onclick=examSubmitAction; $("#examQuit").onclick=quitExam;
  $("#examReviewBtn").onclick=()=>{ renderExamReview(); $("#examReviewBtn").classList.add("hidden"); };
  $("#examRetry").onclick=()=>{ const k=exam&&exam.key, from=exam&&exam.from; if(k) startExam(k,{from}); };
  $("#examDoneHome").onclick=()=>{ const from=exam?exam.from:"home"; exam=null; go(from&&from!=="exam"?from:"home"); };
  // browse / terms search
  $("#browseSearch").oninput=e=>{ browseCtx.q=e.target.value; browseCtx.limit=25; renderBrowse(); };
  $("#termsSearch").oninput=e=>{ termsCtx.q=e.target.value; termsCtx.limit=40; renderTerms(); };
  $("#termsBack").onclick=()=>go("sub:ANIT");
  // keyboard
  document.addEventListener("keydown",e=>{
    if(e.target&&/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    if($("#view-exam").classList.contains("active")&&exam&&!exam.submitted){
      if(/^[1-4]$/.test(e.key)){ const b=$$("#examChoices .choice")[+e.key-1]; if(b&&!b.disabled){ b.click(); e.preventDefault(); } }
      else if(e.key==="Enter"||e.key===" "){ const dn=$("#drillNext"); if(dn) dn.click(); else examNextAction(); e.preventDefault(); }
      else if(e.key==="ArrowRight"&&!exam.noBack){ examNextAction(); } else if(e.key==="ArrowLeft"&&!exam.noBack){ examPrevAction(); }
      return; }
    if($("#view-flash").classList.contains("active")&&flashSes&&flashSes.queue.length){
      if(e.key===" "||e.key==="Enter"){ flashSes.flipped=!flashSes.flipped; renderFlash(); e.preventDefault(); }
      else if(flashSes.flipped&&/^[1-4]$/.test(e.key)) gradeFlash(["again","hard","good","easy"][+e.key-1]); }
  });
  // lifecycle
  document.addEventListener("visibilitychange",()=>{
    if(document.visibilityState==="hidden"){ if(persistBlocked()) return;
      if(exam&&!exam.submitted){ settleExamClock(); if(exam&&!exam.submitted){ closeOpenQuestion(exam); saveExamSnap(); } }
      saveNow(); flushPush(); return; }
    if(exam&&!exam.submitted){ examAcquireWake(); if(exam._openIdx==null){ exam._openIdx=exam.idx; exam._openAt=Date.now(); } else if(!exam._openAt) exam._openAt=Date.now(); }
    if(!sessionActive()){ softRender(); pullMiscIfStale(); }     // 다른 기기에서 푼 진도 받아오기
  });
  window.addEventListener("focus",()=>{ if(!sessionActive()) pullMiscIfStale(); });
  window.addEventListener("online",()=>{ if(!sb&&syncSessionUrl&&syncSessionKey){ initSync(); return; }
    if(sb&&!syncReady){ clearTimeout(pullRetryTimer); pullRetryTimer=null; retryInitialPull(); }
    else if(sb&&hasPendingPush()){ pushRetryCount=0; pushRetryAt=0; schedulePush(0); } });
  let lastDay=todayStr();
  setInterval(()=>{ if(todayStr()!==lastDay){ lastDay=todayStr(); if(!sessionActive()) softRender(); } },60000);
  const flushBeforeExit=()=>{ if(persistBlocked()) return; if(exam&&!exam.submitted){ settleExamClock(); if(exam&&!exam.submitted) saveExamSnap(); } saveNow(); flushPush(); };
  window.addEventListener("pagehide",flushBeforeExit); window.addEventListener("beforeunload",flushBeforeExit);
}
