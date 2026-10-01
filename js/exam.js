/* ============================================================
   ASTB-E Prep — exam.js
   시험 엔진: 프리셋 · 섹션별 타이머 · 되돌아가기 금지 · 학습 모드(즉시 해설)
   적응형(CAT) 실전은 cat.js — 이 러너에 exam.cat 플래그로 붙는다(안내 화면·확인·채점만 분기)
   중단 복구 스냅샷 · 화면 꺼짐 방지 · 채점/기록 · 초반 5문제 · 해설/틀린 이유
   (타이머·스냅샷·채점 골격은 AFOQT Master app.js의 startExam~submitExam 이식)
   ============================================================ */
"use strict";

let exam = null;
let EXAM_PRESETS = {};

/* ---------- presets ---------- */
function registerPresets(){
  EXAM_PRESETS = {};
  const P=(key,o)=>{ EXAM_PRESETS[key]=o; };
  // 적응형(CAT) 실전: 문항을 미리 뽑지 않고, 답할 때마다 실력 추정치에 맞춰 다음 문항을 고른다(cat.js)
  P("oar",{name:"OAR 실전 모의고사 · 적응형",icon:"🏆",desc:"MST 30 → RCT 20 → MCT 30 · 85분 — 맞히면 어려워지는 실전 방식 · 끝나면 예상 OAR",kind:"mock",
    cat:OAR_SUBS});
  P("full",{name:"ASTB-E 학과 전체 · 적응형",icon:"🎖️",desc:"OAR 3과목 + ANIT 30 · 100분 — 실전 순서·시간 그대로",kind:"mock",cat:SUBS});
  P("diag",{name:"진단 미니 모의고사 · 적응형",icon:"🩺",desc:"MST 10 · RCT 7 · MCT 10 · ANIT 10 · 약 34분 — 지금 실력부터",kind:"mock",
    cat:SUBS, catN:{MST:10,RCT:7,MCT:10,ANIT:10}});
  for(const s of SUBS) P("sub:"+s,{name:`${SUBMETA[s].ko} 실전 (${s}) · 적응형`,icon:SUBMETA[s].icon,
    desc:`${SUBMETA[s].n}문항 · ${SUBMETA[s].secs/60}분 · 맞히면 어려워지고 틀리면 쉬워져요`,kind:"sub",cat:[s]});
  for(const L of Object.keys(MOCKS)){ const m=MOCKS[L];
    P("form_"+L,{name:m.name_ko||("실전 모의고사 "+L.toUpperCase()),icon:"📘",kind:"form",
      desc:m.sections.map(x=>`${x.code} ${x.items.length}`).join(" · ")+` · ${Math.round(m.sections.reduce((t,x)=>t+x.secs,0)/60)}분 · 고정 문항`,
      build:()=>m.sections.flatMap(sec=>(sec.items||[]).map(q=>toItem(sec.code,q,"form_"+L))),
      secMap:Object.fromEntries(m.sections.map(x=>[x.code,x.secs]))}); }
  for(const s of SUBS) bankSets(s).forEach((ids,i)=>P(`set:${s}:${i+1}`,{name:`${s} SET ${String(i+1).padStart(2,"0")}`,icon:SUBMETA[s].icon,kind:"set",
    desc:`${ids.length}문항 · ${fmtTime(ids.length*SECRATE[s])}`,build:()=>ids.map(itemById).filter(Boolean)}));
}

/* ---------- launchers ---------- */
function startExam(key, opts={}){
  const p=EXAM_PRESETS[key]; if(!p){ toast("시험 구성을 찾지 못했어요."); return; }
  if(p.cat){ launchCat({key, name:p.name, kind:p.kind, codes:p.cat, catN:p.catN, practice:!!opts.practice, from:opts.from}); return; }
  launchExam({key, name:p.name, items:p.build(), kind:p.kind, secMap:p.secMap, practice:!!opts.practice, from:opts.from});
}
function startDrill(sub, opt={}){
  const f = opt.topic ? (q=>q.topic===opt.topic) : opt.qtype ? (q=>q.qtype===opt.qtype) : opt.filter || null;
  const items=orderForExam(pickFresh(sub, opt.n||10, f));
  launchExam({key:null, name:opt.label||`${SUBMETA[sub].ko} 드릴`, items, learn:opt.learn!==false, kind:"drill", from:opt.from});
}
function startPicked(subs){
  const list=SUBS.filter(s=>subs.includes(s)); if(!list.length) return;
  launchCat({key:"pick", name:`직접 고른 모의고사 (${list.join("·")}) · 적응형`, codes:list, kind:"mock"});
}
// 오답노트 재풀이 — 기본은 학습 모드(즉시 해설). timed=true면 실전 시간.
function startWrongReview(opt={}){
  const list=(opt.due?dueWrongs(opt.sub):activeWrongs(opt.sub))
    .sort((a,b)=>SUBS.indexOf(a[1].s)-SUBS.indexOf(b[1].s) || (a[1].next||"").localeCompare(b[1].next||""));
  const items=list.map(([id])=>itemById(id)).filter(Boolean).slice(0,60);
  if(!items.length){ toast(opt.due?"오늘 다시 볼 오답이 없어요 👍":"오답이 없어요 👍"); return; }
  launchExam({key:null, name:(opt.due?"오늘 다시 볼 오답":"오답 재풀이")+(opt.sub?` · ${opt.sub}`:""), items,
    learn:!opt.timed, kind:"review", from:"wrong"});
}
function launchExam(cfg){
  const items=(cfg.items||[]).filter(Boolean);
  if(!items.length){ toast("문제 데이터가 아직 없어요. 잠시 후 다시 시도해 주세요."); return; }
  if(!confirmDropExamSnap()) return;
  const n=items.length, learn=!!cfg.learn, practice=!!cfg.practice;
  const base=items.reduce((t,it)=>t+(SECRATE[it.section]||30),0);
  const secs=learn?Math.max(120,n*300):practice?Math.round(base*2.2):base;
  exam={key:cfg.key||null, name:cfg.name||"모의고사", kind:cfg.kind||"", items, idx:0, total:n,
    answers:new Array(n).fill(null), locked:new Array(n).fill(false), recorded:new Array(n).fill(false),
    secsLeft:secs, startSecs:secs, submitted:false, timerId:null, learn, practice,
    noBack:!learn && flag("no_back"), from:cfg.from||curView||"mock"};
  if(!learn && new Set(items.map(it=>it.section)).size>1) buildExamSections(exam, practice?2.2:1, cfg.secMap);
  showExamRun(); startExamTimer(); renderExamQ();
}
function showExamRun(){
  $$(".view").forEach(v=>v.classList.remove("active")); $("#view-exam").classList.add("active");
  $("#examResult").classList.add("hidden"); $("#examRun").classList.remove("hidden"); window.scrollTo(0,0);
}

/* ---------- 섹션별 타이머 (실전처럼 과목마다 자기 시계, 끝난 섹션으로는 못 돌아감) ---------- */
function buildExamSections(e, mult=1, secMap){
  const secs=[]; let cur=null;
  e.items.forEach((it,i)=>{ if(!cur||cur.code!==it.section){ cur={code:it.section,from:i,to:i,secs:0}; secs.push(cur); }
    cur.to=i; cur.secs+=(SECRATE[it.section]||30); });
  if(secs.length<2) return false;
  secs.forEach(s=>{ if(secMap&&secMap[s.code]) s.secs=secMap[s.code]; s.secs=Math.round(s.secs*mult); s.left=s.secs; });
  e.sections=secs; e.secIdx=0; e.idx=secs[0].from; return true;
}
function curExamSec(){ return (exam&&exam.sections)?exam.sections[exam.secIdx]:null; }
function closeOpenQuestion(e){ e.times=e.times||new Array(e.total).fill(0);
  if(e._openIdx!=null&&e._openAt){ e.times[e._openIdx]+=Date.now()-e._openAt; } e._openIdx=null; e._openAt=null; }
function advanceExamSection(auto){
  const e=exam; if(!e||!e.sections||e.submitted) return;
  const s=e.sections[e.secIdx];
  if(!auto&&e.cat){ const rem=s.n-catSecAnswered(e,s);
    if(rem>0 && !confirm(`이 섹션에 아직 ${rem}문항이 남았어요.\n지금 끝내면 남은 문항은 미응답으로 감점되고, 돌아올 수 없어요. 끝낼까요?`)) return; }
  else if(!auto){ const un=e.answers.slice(s.from,s.to+1).filter(a=>a==null).length;
    if(un && !confirm(`이 섹션에서 ${un}문제를 안 풀었어요.\n다음 섹션으로 넘어가면 돌아올 수 없어요. 계속할까요?`)) return; }
  if(e.cat&&e.items[e.idx]&&!e.locked[e.idx]) e.answers[e.idx]=null;      // '확인' 안 누른 선택은 응답이 아니다
  s.leftAtDone=Math.max(0,s.left); s.autoOut=!!auto; s.left=0; s.done=true;
  if(s.from!=null) for(let i=s.from;i<=s.to;i++) e.locked[i]=true;
  closeOpenQuestion(e);
  if(e.secIdx>=e.sections.length-1){ submitExam(true); return; }
  e.secIdx++;
  if(e.cat){ e.paused=true; saveExamStatic(); saveExamSnap(); updateTimerUI();
    toast(`${auto&&s.leftAtDone<=0?"⏰ 시간 종료":"✅ 섹션 완료"} → 다음: ${SUBMETA[e.sections[e.secIdx].code].ko}`,2600);
    window.scrollTo(0,0); renderExamQ(); return; }
  e.idx=e.sections[e.secIdx].from; saveExamSnap(); updateTimerUI();
  const nx=e.sections[e.secIdx];
  toast(`${auto&&s.leftAtDone<=0?"⏰ 시간 종료":"✅ 섹션 완료"} → ${SUBMETA[nx.code].ko} ${nx.to-nx.from+1}문항 ${Math.round(nx.secs/60)}분`,3000);
  window.scrollTo(0,0); renderExamQ();
}
function consumeExamSeconds(elapsed){
  while(elapsed>0&&exam&&!exam.submitted){
    const s=curExamSec(), left=s?s.left:exam.secsLeft, use=Math.min(Math.max(0,left),elapsed);
    if(s) s.left-=use; else exam.secsLeft-=use; elapsed-=use;
    if((s?s.left:exam.secsLeft)<=0){ if(s) advanceExamSection(true); else submitExam(true); } else break;
  }
}
// 브라우저가 백그라운드 타이머를 늦춰도 호출 횟수가 아니라 실제 경과 초를 차감한다.
function settleExamClock(now=Date.now()){
  if(!exam||exam.submitted||!exam._timerAt) return;
  if(now<exam._timerAt||exam.paused){ exam._timerAt=now; return; }      // 적응형 섹션 안내 화면에서는 시계가 멈춘다
  const elapsed=Math.floor((now-exam._timerAt)/1000); if(elapsed<1) return;
  exam._timerAt+=elapsed*1000; if(!exam.learn) consumeExamSeconds(elapsed);
  if(exam&&!exam.submitted) updateTimerUI();
}
function startExamTimer(){ stopExamTimer(); updateTimerUI(); exam._timerAt=Date.now();
  examAcquireWake(); saveExamStatic(); saveExamSnap();
  exam.timerId=setInterval(()=>{ if(!exam) return stopExamTimer(); settleExamClock();
    if(exam&&!exam.submitted&&((exam._tick=(exam._tick||0)+1)%5===0)) saveExamSnap(); },1000); }
function stopExamTimer(){ if(exam&&exam.timerId){ clearInterval(exam.timerId); exam.timerId=null; } }
function updateTimerUI(){ const t=$("#examTimer"); if(!t||!exam) return;
  if(exam.learn){ t.textContent="📚 학습"; t.classList.remove("warn"); }
  else { const s=curExamSec(), left=s?s.left:exam.secsLeft; t.textContent=fmtTime(left); t.classList.toggle("warn",left<=30); }
  const chip=$("#qTimeChip"), e=exam;
  if(chip&&!e.submitted&&e._openAt&&e.times){ const sec=Math.round(((e.times[e.idx]||0)+(Date.now()-e._openAt))/1000), tgt=SECRATE[(e.items[e.idx]||{}).section]||30;
    chip.textContent=`⏱ ${sec}초 / ${tgt}초`; chip.classList.toggle("over",sec>tgt); } }

/* ---------- 화면 꺼짐 방지 ---------- */
let examWake=null;
async function examAcquireWake(){ try{ if("wakeLock" in navigator && !examWake){ const wl=await navigator.wakeLock.request("screen");
  if(!exam||exam.submitted){ try{ wl.release&&wl.release(); }catch{} return; }
  examWake=wl; examWake.addEventListener&&examWake.addEventListener("release",()=>{ examWake=null; }); } }catch{} }
function examReleaseWake(){ try{ examWake&&examWake.release&&examWake.release(); }catch{} examWake=null; }

/* ---------- 중단 복구 스냅샷 (문항은 id만 저장 → 복원 시 ITEM_INDEX로 재구성) ---------- */
function saveExamStatic(){ const e=exam; if(!e||e.submitted) return;
  try{ const snap={key:e.key,name:e.name,kind:e.kind,ids:e.items.map(it=>it.qid),total:e.total,learn:!!e.learn,practice:!!e.practice,
      noBack:!!e.noBack,startSecs:e.startSecs,from:e.from,savedAt:Date.now(),cat:e.cat?1:0};
    if(e.sections) snap.sections=e.sections.map(s=>({code:s.code,from:s.from,to:s.to,secs:s.secs,n:s.n}));
    localStorage.setItem(LS.examSave,JSON.stringify(snap)); }catch{ clearExamSnap(); } }
function saveExamSnap(paused){ const e=exam; if(!e||e.submitted) return;
  try{ const dyn={answers:e.answers,locked:e.locked,recorded:e.recorded,idx:e.idx,secsLeft:e.secsLeft,times:e.times||null,
      timerAt:(paused||e.paused)?null:(e._timerAt||null),paused:e.paused?1:0,savedAt:Date.now()};
    if(e.sections){ dyn.secIdx=e.secIdx; dyn.secDyn=e.sections.map(s=>({left:s.left,done:!!s.done,leftAtDone:s.leftAtDone,autoOut:!!s.autoOut})); }
    localStorage.setItem(LS.examDyn,JSON.stringify(dyn)); }catch{ clearExamSnap(); } }
function clearExamSnap(){ try{ localStorage.removeItem(LS.examSave); localStorage.removeItem(LS.examDyn); }catch{} }
function loadExamSnap(){
  try{ const st=JSON.parse(localStorage.getItem(LS.examSave)||"null"), dyn=JSON.parse(localStorage.getItem(LS.examDyn)||"null");
    if(!(st&&st.ids&&st.ids.length&&dyn&&dyn.answers)) return null;
    if(Date.now()-(dyn.savedAt||0)>72*3600*1000) return null;          // 3일 지난 시험은 만료
    return {...st,...dyn}; }catch{ return null; } }
function confirmDropExamSnap(){ const s=loadExamSnap(); if(!s) return true;
  const done=(s.answers||[]).filter(a=>a!=null).length; if(!done) return true;
  return confirm(`⏸ 하다 만 시험이 있어요 — "${s.name||"시험"}" ${done}/${s.total}문항.\n새로 시작하면 사라져요. 계속할까요?`); }
function resumeExamSnap(){
  const s=loadExamSnap(); if(!s){ toast("이어할 시험이 없어요."); return; }
  const items=s.ids.map(itemById);
  if(items.some(x=>!x)){ clearExamSnap(); toast("문제 데이터가 바뀌어 이어 풀 수 없어요."); softRender(); return; }
  const offline=!s.learn&&s.timerAt?Math.max(0,Math.floor((Date.now()-s.timerAt)/1000)):0;   // 강제 종료 동안 흐른 시간
  exam={key:s.key,name:s.name,kind:s.kind,items,idx:s.idx||0,total:s.total,answers:s.answers,
    locked:s.locked||new Array(s.total).fill(false),recorded:s.recorded||new Array(s.total).fill(false),
    secsLeft:s.secsLeft,startSecs:s.startSecs,submitted:false,timerId:null,times:s.times||undefined,
    learn:!!s.learn,practice:!!s.practice,noBack:!!s.noBack,from:s.from||"mock",cat:!!s.cat,paused:!!s.paused};
  if(exam.cat&&!Array.isArray(exam.times)) exam.times=new Array(items.length).fill(0);
  if(s.sections){ exam.sections=s.sections.map((b,i)=>{ const d=(s.secDyn||[])[i]||{};
      return {...b,left:d.left!=null?d.left:b.secs,done:!!d.done,leftAtDone:d.leftAtDone,autoOut:!!d.autoOut}; });
    exam.secIdx=s.secIdx||0; }
  showExamRun(); renderExamQ(); if(offline) consumeExamSeconds(offline);
  if(exam&&!exam.submitted){ startExamTimer(); renderExamQ(); toast("⏸ 저장된 지점부터 이어서 시작해요."); }
}
// 나가기: 학습 모드는 푼 만큼 채점, 실전은 시계를 멈추고 저장(모의고사 화면에서 이어 풀기)
function quitExam(){
  const e=exam; if(!e||e.submitted) return;
  if(e.learn){ if(e.answers.some(a=>a!=null)) submitExam(true); else { stopExamTimer(); clearExamSnap(); examReleaseWake(); exam=null; go(e.from); } return; }
  if(!confirm("시험을 잠시 멈추고 나갈까요?\n시계가 멈추고, 모의고사 화면의 '이어서 풀기'로 돌아올 수 있어요.")) return;
  settleExamClock(); closeOpenQuestion(e); saveExamSnap(true); stopExamTimer(); examReleaseWake();
  const from=e.from; exam=null; go(from==="exam"?"mock":from);
}

/* ---------- 문항 화면 ---------- */
function renderExamQ(){
  const e=exam; if(!e) return;
  const sec=curExamSec();
  if(e.cat&&e.paused){ renderCatIntro(); return; }
  $(".exam-nav").classList.remove("hidden");
  e.idx=sec?clamp(e.idx,sec.from,sec.to):clamp(e.idx,0,e.total-1);
  const it=e.items[e.idx], nowT=Date.now();
  e.times=e.times||new Array(e.total).fill(0);
  if(e._openIdx!=null&&e._openIdx!==e.idx&&!e.submitted&&e._openAt) e.times[e._openIdx]+=nowT-e._openAt;
  if(e._openIdx!==e.idx||!e._openAt){ e._openIdx=e.idx; e._openAt=nowT; }
  if(sec){ const n=e.cat?sec.n:sec.to-sec.from+1, pos=e.idx-sec.from+1; $("#examCount").textContent=e.cat?`${sec.code} · ${pos} / ${n}`:`${pos} / ${n}`; $("#examBar").style.width=((pos-1)/n*100)+"%"; }
  else { $("#examCount").textContent=`${e.idx+1} / ${e.total}`; $("#examBar").style.width=(e.idx/e.total*100)+"%"; }
  const revealed=e.learn&&e.answers[e.idx]!=null, showKo=!flag("hide_ko")&&(!e.cat||flag("cat_ko"));
  const chipTxt=`${SUBMETA[it.section].ko}${e.learn?" · "+(it.section==="RCT"?(RCT_QTYPE_KO[it.qtype]||""):topicKo(it.section,it.topic)):""}`;
  const passage=it.section==="RCT"&&it.passage?`<div class="rct-passage"><div class="tt">📖 ${esc(it.title||"Passage")}</div><div class="passage">${esc(it.passage)}</div>${
      (e.learn&&it.passageKo&&showKo)?`<details class="ko-details"><summary>한글 번역 보기</summary><div class="kotxt">${esc(it.passageKo)}</div></details>`:""}</div>`:"";
  const ko=(showKo&&it.promptKo)?`<div class="exam-ko">${fmtMath(it.promptKo)}</div>`:"";
  const fig=it.fig?`<div class="figbox">${renderFig(it.fig)}</div>`:"";
  const choices=it.options.map((o,i)=>{ let cls=e.answers[e.idx]===i?"sel":"";
    if(revealed){ if(i===it.answer) cls="correct"; else if(i===e.answers[e.idx]) cls="wrong"; }
    return `<button class="choice ${cls}" data-i="${i}" ${revealed||e.locked[e.idx]?"disabled":""}>${fmtMath(o)}</button>`; }).join("");
  const okAns=revealed&&e.answers[e.idx]===it.answer;
  const explain=revealed?`<div class="exam-explain ${okAns?"ok":"no"}">
      <div class="ee-head">${okAns?"✅ 정답":"❌ 오답 · 정답: "+(it.answer+1)+". "+fmtMath(it.options[it.answer])}</div>
      <div class="ee-body">${fmtMath(it.explain||"")}</div>
      ${okAns?"":reasonHTML(it.qid)}
      <button class="btn primary" id="drillNext" style="margin-top:12px">${e.idx>=e.total-1?"결과 보기 →":"다음 문제 →"}</button></div>`:"";
  const banner=sec?`<div class="sec-banner"><div><b>${e.sections.length>1?`섹션 ${e.secIdx+1}/${e.sections.length} · `:""}${SUBMETA[sec.code].ko} (${sec.code})</b>
      <span class="muted"> ${e.cat?`적응형 ${sec.n}문항`:`${sec.to-sec.from+1}문항`} · ${Math.round(sec.secs/60)}분</span></div><div class="muted">${
      e.cat&&flag("cat_show_level")?`난이도 <span class="dchip">${diffDots(it.diff)}</span> ${DIFF_KO[catLevel(it)]}`:`전체 ${e.idx+1}/${e.total}`}</div></div>`:"";
  $("#examArea").innerHTML=`${banner}${passage}<div class="card">
    <span class="exam-sec">${esc(chipTxt)}</span>${e.cat&&!flag("cat_show_level")?"":`<span class="qtime" id="qTimeChip">⏱ 0초 / ${SECRATE[it.section]||30}초</span>`}
    <div class="exam-prompt">${fmtMath(it.prompt)}</div>${ko}${fig}
    <div class="choices" id="examChoices">${choices}</div>${explain}</div>`;
  $$("#examChoices .choice").forEach(btn=>btn.onclick=()=>{
    if(e.locked[e.idx]||(e.learn&&e.answers[e.idx]!=null)) return;
    const i=+btn.dataset.i; e.answers[e.idx]=i;
    if(e.learn){ e.locked[e.idx]=true; recordLearn(e.idx); saveExamSnap(); renderExamQ(); return; }
    $$("#examChoices .choice").forEach(b=>b.classList.toggle("sel",b===btn)); refreshExamGrid(); saveExamSnap();
    if(e.noBack){ $("#examNext").disabled=false; return; }        // '확인 →'으로 진행
    const last=sec?sec.to:e.total-1;
    if(e.idx<last) setTimeout(()=>{ if(exam===e&&!e.submitted&&e.idx<last&&e.answers[e.idx]===i){ e.idx++; renderExamQ(); } },170);
  });
  const dn=$("#drillNext"); if(dn) dn.onclick=()=>{ if(e.idx>=e.total-1) submitExam(true); else { e.idx++; renderExamQ(); } };
  // 내비 버튼: 되돌아가기 금지면 이전·문항 그리드를 숨기고 '확인 →'만 둔다
  const prev=$("#examPrev"), next=$("#examNext"), sub=$("#examSubmit");
  prev.classList.toggle("hidden",e.noBack); $("#examGrid").classList.toggle("hidden",e.noBack); $("#kbdArrows").classList.toggle("hidden",e.noBack);
  if(e.noBack){ next.textContent="확인 →"; next.disabled=e.answers[e.idx]==null; }
  else { next.textContent="다음 →"; prev.disabled=sec?e.idx<=sec.from:e.idx===0; next.disabled=sec?e.idx>=sec.to:e.idx>=e.total-1; }
  next.classList.toggle("primary",!!e.cat); next.classList.toggle("ghost",!e.cat);
  sub.textContent=e.learn?"끝내기":e.cat?"섹션 끝내기":sec?(e.secIdx<e.sections.length-1?"섹션 제출 →":"최종 제출"):"제출";
  sub.classList.toggle("primary",!e.cat); sub.classList.toggle("ghost",!!e.cat); sub.classList.toggle("cat-end",!!e.cat);
  if(!e.noBack) renderExamGrid();
  updateTimerUI();
}
function renderExamGrid(){ const e=exam, s=curExamSec(), from=s?s.from:0, to=s?s.to:e.total-1; let html="";
  for(let i=from;i<=to;i++) html+=`<button data-i="${i}" class="${e.answers[i]!=null?"answered":""} ${i===e.idx?"cur":""}">${i-from+1}</button>`;
  $("#examGrid").innerHTML=html; $$("#examGrid button").forEach(b=>b.onclick=()=>{ e.idx=+b.dataset.i; renderExamQ(); }); }
function refreshExamGrid(){ const e=exam; const b=$(`#examGrid button[data-i="${e.idx}"]`); if(b) b.classList.add("answered"); }
function examNextAction(){
  const e=exam; if(!e||e.submitted) return;
  if(e.cat){ if(e.paused) catBeginSection(); else catConfirm(); return; }
  const sec=curExamSec(), last=sec?sec.to:e.total-1;
  if(e.learn){ if(e.answers[e.idx]==null) return; if(e.idx>=e.total-1) submitExam(true); else { e.idx++; renderExamQ(); } return; }
  if(e.noBack){
    if(e.answers[e.idx]==null){ toast("답을 골라야 넘어가요 (적응형 실전은 건너뛰기 불가)"); return; }
    e.locked[e.idx]=true;
    if(e.idx>=last){ if(sec) advanceExamSection(false); else submitExam(false); }
    else { e.idx++; saveExamSnap(); renderExamQ(); }
    return;
  }
  if(e.idx<last){ e.idx++; renderExamQ(); }
}
function examPrevAction(){ const e=exam; if(!e||e.submitted||e.noBack) return; const sec=curExamSec();
  if(e.idx>(sec?sec.from:0)){ e.idx--; renderExamQ(); } }
function examSubmitAction(){ const e=exam; if(!e) return;
  if(e.learn){ quitExam(); return; }
  if(e.cat&&e.paused) return;
  if(curExamSec()) advanceExamSection(false); else submitExam(false); }

/* ---------- 기록 ---------- */
function recordResult(it,ok){
  const s=it.section, o=state.secAcc[s]||(state.secAcc[s]={c:0,w:0}); if(ok) o.c++; else o.w++;
  statBump(s);
  const k=weakKey(it), t=state.weak.topic[k]||(state.weak.topic[k]={c:0,w:0}); if(ok) t.c++; else t.w++;
  (state.qSeen[s]||(state.qSeen[s]={}))[it.qid]=Date.now();
  noteAnswer(it,ok);
}
function recordLearn(i){ const e=exam, it=e.items[i], ok=e.answers[i]===it.answer;
  if(e.recorded[i]) return; recordResult(it,ok); e.recorded[i]=true;
  if(e.kind==="review") statBump("review");
  bumpDay({studied:1,correct:ok?1:0}); }
function pruneExamDetail(){ const keep=20; let n=0;
  for(let i=state.examHist.length-1;i>=0;i--){ const h=state.examHist[i]; if(h&&(h.items||h.cat)){ n++;
    if(n>keep){ delete h.items; if(h.cat) for(const k in h.cat) if(h.cat[k]) delete h.cat[k].path; } } } }

/* ---------- 채점 ---------- */
function submitExam(auto){
  const e=exam; if(!e||e.submitted) return;
  if(e.cat){ submitCat(auto); return; }
  const ansBySec={}; e.items.forEach((it,i)=>{ if(e.answers[i]!=null) ansBySec[it.section]=(ansBySec[it.section]||0)+1; });
  const skipped=[...new Set(e.items.map(it=>it.section))].filter(sc=>!(ansBySec[sc]>0));
  let counted=e.items.map((_,i)=>i).filter(i=>!skipped.includes(e.items[i].section));
  if(e.learn) counted=counted.filter(i=>e.answers[i]!=null);
  if(!auto&&!e.learn){ const un=counted.filter(i=>e.answers[i]==null).length;
    const skipTxt=skipped.length?`\n(${skipped.join("·")}은 한 문제도 안 풀어 채점에서 제외돼요)`:"";
    if(un && !confirm(`아직 ${un}문제를 안 풀었어요. 미응답은 오답으로 처리돼요. 제출할까요?${skipTxt}`)) return; }
  e.submitted=true; stopExamTimer(); clearExamSnap(); examReleaseWake(); closeOpenQuestion(e);
  if(!counted.length){ toast("푼 문항이 없어 기록 없이 종료했어요."); exam=null; go(e.from); return; }
  e._skipped=skipped; e._counted=counted;
  let got=0; const bySec={};
  counted.forEach(i=>{ const it=e.items[i], ok=e.answers[i]===it.answer; if(ok) got++;
    const b=bySec[it.section]||(bySec[it.section]={got:0,total:0}); b.total++; if(ok) b.got++;
    if(!e.recorded[i]){ recordResult(it,ok); e.recorded[i]=true; } });
  // 초반 5문제 (적응형 대비: 섹션 첫 5문항 정확도)
  let f5=null;
  if(!e.learn&&!e.practice){ f5={}; const cnt={};
    e.items.forEach((it,i)=>{ if(skipped.includes(it.section)) return; const c=cnt[it.section]=(cnt[it.section]||0)+1;
      if(c<=5){ const o=f5[it.section]||(f5[it.section]=[0,0]); o[1]++; if(e.answers[i]===it.answer) o[0]++; } });
    for(const s in f5){ const g=state.first5[s]||(state.first5[s]={c:0,n:0}); g.c+=f5[s][0]; g.n+=f5[s][1]; } }
  // 풀이 속도 (답한 문항만, 실전 배분의 1.3배 초과 = 느림)
  const speedBySec={};
  e.items.forEach((it,i)=>{ if(e.answers[i]==null) return; const ms=e.times[i]||0; if(!ms) return; const tgt=(SECRATE[it.section]||30)*1000;
    const o=speedBySec[it.section]||(speedBySec[it.section]={n:0,ms:0,slow:0}); o.n++; o.ms+=ms; if(ms>tgt*1.3) o.slow++;
    if(!e.learn){ const g=state.speed[it.section]||(state.speed[it.section]={n:0,ms:0,slow:0}); g.n++; g.ms+=ms; if(ms>tgt*1.3) g.slow++; } });
  const total=counted.length, pct=Math.round(got/total*100);
  const used=e.sections?e.sections.reduce((a,s)=>a+(s.secs-Math.max(0,s.leftAtDone!=null?s.leftAtDone:s.left)),0)
    : e.learn?Math.round(counted.reduce((t,i)=>t+(e.times[i]||0),0)/1000) : (e.startSecs-Math.max(0,e.secsLeft));
  if(e.learn) bumpDay({seconds:used}); else bumpDay({studied:total,correct:got,seconds:used});
  if(e.key&&!e.practice&&!e.learn){ const prev=state.exams[e.key]||{}, nb=got/total>(prev.best||0)/(prev.bestTotal||1);
    state.exams[e.key]={best:nb?got:(prev.best||0),bestTotal:nb?total:(prev.bestTotal||total),last:got,lastTotal:total,date:todayStr(),updated_at:nowISO()}; }
  if(MOCK_KEYS.has(e.key)&&!e.practice) statBump("mock");
  const h={key:e.key||(e.kind==="review"?"review":"drill"),name:e.name,kind:e.kind,date:todayStr(),got,total,acc:got/total,ts:Date.now(),secs:used,
    bySec:JSON.parse(JSON.stringify(bySec)),f5:f5||undefined,practice:e.practice?1:undefined,learn:e.learn?1:undefined,
    skipped:skipped.length?skipped.slice():undefined,
    items:counted.map(i=>({id:e.items[i].qid,u:e.answers[i],a:e.items[i].answer,ms:Math.round(e.times[i]||0)}))};
  const oar=(!e.learn&&!e.practice)?examOAR(h):null; if(oar!=null) h.oar=oar;
  state.examHist.push(h); if(state.examHist.length>200) state.examHist=state.examHist.slice(-200);
  pruneExamDetail(); saveNow(); if(typeof queuePush==="function") queuePush("app_state");
  renderExamResult(e,{got,total,pct,bySec,f5,oar,used,speedBySec,skipped});
}
function renderExamResult(e,r){
  $$(".view").forEach(v=>v.classList.remove("active")); $("#view-exam").classList.add("active");
  $("#examRun").classList.add("hidden"); $("#examResult").classList.remove("hidden");
  $("#examEmoji").textContent=r.pct>=85?"🏆":r.pct>=70?"🎯":r.pct>=50?"💪":"📚";
  $("#examScore").textContent=`${r.got} / ${r.total} 정답 (${r.pct}%)`+(r.skipped.length?` · ${r.skipped.join("·")} 건너뜀`:"");
  $("#examBreakDown").innerHTML=Object.keys(r.bySec).map(k=>`<div class="s"><b>${r.bySec[k].got}/${r.bySec[k].total}</b><span>${SUBMETA[k].ko}</span></div>`).join("");
  const proj=$("#examProjection"); proj.classList.remove("hidden");
  const secLines=Object.keys(r.bySec).map(k=>`${k} ${pctOf(r.bySec[k].got,r.bySec[k].total)}%`).join(" · ");
  const f5Line=r.f5?`<div class="seclist">초반 5문제 정답: ${Object.keys(r.f5).map(k=>`${k} ${r.f5[k][0]}/${r.f5[k][1]}`).join(" · ")}</div>`:"";
  if(e.learn) proj.innerHTML=`<div class="lbl">${e.kind==="review"?"오답 재풀이":"유형 드릴"} 결과</div><div class="big">${r.pct}<span style="font-size:16px">%</span></div>
      <div class="note">틀린 문제는 오답노트에 들어가 <b>3일 뒤</b> 다시 나와요. 연속 2번 맞히면 졸업!</div>`;
  else if(r.oar!=null) proj.innerHTML=`<div class="lbl">예상 OAR (비공식)</div><div class="big">${r.oar}<span style="font-size:15px"> / 80</span></div>
      <div class="seclist">${secLines} · 목표 ${TARGET_OAR}+ ${r.oar>=TARGET_OAR?"✅":"⬆️"}</div>${f5Line}<div class="note">${OAR_NOTE}</div>`;
  else { const s=Object.keys(r.bySec)[0], rd=Object.keys(r.bySec).length===1?readiness(s):null;
    proj.innerHTML=`<div class="lbl">${e.practice?"연습 모드 결과":"정답률"}</div><div class="big">${r.pct}<span style="font-size:16px">%</span></div>
      <div class="seclist">${secLines}${rd!=null?` · ${s} 준비도 ${rd}`:""}</div>${f5Line}
      <div class="note">OAR 추정은 MST·RCT·MCT가 모두 들어간 모의고사에서 계산돼요.</div>`; }
  if(e.sections){ const lines=e.sections.map(s=>{ const left=s.leftAtDone!=null?s.leftAtDone:Math.max(0,s.left);
      return `${s.code} ${fmtTime(s.secs-left)}/${fmtTime(s.secs)}${s.autoOut&&left<=0?"⏰":""}`; }).join(" · ");
    $("#examTimeUsed").innerHTML=`소요 시간 ${fmtTime(r.used)}<br><span style="font-size:11.5px">${esc(lines)}</span>`; }
  else $("#examTimeUsed").textContent=`소요 시간 ${fmtTime(r.used)}${!e.learn&&e.secsLeft<=0?" · ⏰ 시간 종료":""}`;
  const sp=$("#examSpeed"), keys=Object.keys(r.speedBySec);
  if(!keys.length||e.learn) sp.classList.add("hidden");
  else { sp.classList.remove("hidden");
    const pills=keys.map(k=>{ const o=r.speedBySec[k], avg=Math.round(o.ms/o.n/1000), tgt=SECRATE[k]; const ok=avg<=tgt;
      return `<span class="pill" style="${ok?"":"color:var(--warn)"}">${k} ${avg}초${ok?"":"🐢"}<small>/${tgt}초</small></span>`; }).join(" ");
    const slowOK=e.items.filter((it,i)=>e.answers[i]===it.answer&&(e.times[i]||0)>((SECRATE[it.section]||30)*1300)).length;
    sp.innerHTML=`<div style="font-weight:700;font-size:12.5px;margin-bottom:6px">⚡ 풀이 속도 (실전 배분 대비)</div><div class="row wrap" style="gap:6px;justify-content:center">${pills}</div>
      ${slowOK?`<div class="muted" style="font-size:11.5px;margin-top:6px">🐢 맞았지만 느렸던 문항 <b>${slowOK}개</b> — 틀린 이유 '④ 시간 부족' 후보예요.</div>`:`<div class="muted" style="font-size:11.5px;margin-top:6px">✅ 페이스 좋아요.</div>`}`; }
  $("#examReview").innerHTML=""; $("#examReviewBtn").classList.remove("hidden");
  $("#examRetry").classList.toggle("hidden",!e.key||!EXAM_PRESETS[e.key]);
  $("#examDoneHome").textContent={mock:"모의고사로",plan:"플랜으로",wrong:"오답노트로",home:"홈으로"}[e.from]||(String(e.from).startsWith("sub:")?"과목으로":"돌아가기");
  // 틀린 문제가 있으면 해설을 바로 펼쳐 이유를 기록하게 유도
  const wrongN=r.total-r.got; if(wrongN>0&&!e.learn){ renderExamReview(); $("#examReviewBtn").classList.add("hidden"); }
  window.scrollTo(0,0);
}
function reviewItemHTML(it,pick,num,ms,opts={}){
  if(!it) return `<div class="review-q"><div class="rh">${num}. (문항을 찾을 수 없어요 — 데이터가 바뀌었을 수 있어요)</div></div>`;
  const ok=pick===it.answer, tgt=SECRATE[it.section]||30;
  const opt=it.options.map((o,oi)=>{ const cls=oi===it.answer?"ok":(oi===pick?"no":""), mark=oi===it.answer?"✓ ":(oi===pick?"✗ ":"");
    return `<div class="ro ${cls}">${mark}${oi+1}. ${fmtMath(o)}</div>`; }).join("");
  const passage=it.section==="RCT"&&it.passage?`<details class="ko-details" ${opts.openPassage?"open":""}><summary>📖 지문: ${esc(it.title)}</summary><div class="passage" style="font-size:14px;margin-top:6px">${esc(it.passage)}</div>${
    it.passageKo?`<details class="ko-details"><summary>한글 번역</summary><div class="kotxt">${esc(it.passageKo)}</div></details>`:""}</details>`:"";
  const lbl=it.section==="RCT"?(RCT_QTYPE_KO[it.qtype]||""):topicKo(it.section,it.topic);
  return `<div class="review-q">
    <div class="rh">${num}. ${it.section} · ${esc(lbl)} ${ok?"✅":pick==null?"⬜ 미응답":"❌"}<span class="muted" style="font-weight:400">${ms?` · ${Math.round(ms/1000)}초${ms>tgt*1300?" 🐢":""}`:""}</span></div>
    ${passage}<div style="font-weight:600;margin:6px 0">${fmtMath(it.prompt)}</div>
    ${it.promptKo&&!flag("hide_ko")?`<div class="exam-ko">${fmtMath(it.promptKo)}</div>`:""}
    ${it.fig?`<div class="figbox">${renderFig(it.fig)}</div>`:""}${opt}
    ${it.explain?`<div class="rx">${fmtMath(it.explain)}</div>`:""}
    ${!ok&&state.wrongs[it.qid]&&wrongActive(state.wrongs[it.qid])?reasonHTML(it.qid):""}</div>`;
}
function renderExamReview(){
  const e=exam; if(!e) return; const skip=e._skipped||[];
  const idxs=(e._counted||e.items.map((_,i)=>i)).filter(i=>!skip.includes(e.items[i].section));
  const wrongFirst=[...idxs.filter(i=>e.answers[i]!==e.items[i].answer), ...idxs.filter(i=>e.answers[i]===e.items[i].answer)];
  const nWrong=idxs.length-idxs.filter(i=>e.answers[i]===e.items[i].answer).length;
  $("#examReview").innerHTML=(nWrong?`<h2 class="section">❌ 틀린 문제 ${nWrong} — 틀린 이유를 골라 두세요</h2>`:"")+
    wrongFirst.map((i,k)=>(k===nWrong&&nWrong?`<h2 class="section">✅ 맞힌 문제</h2>`:"")+reviewItemHTML(e.items[i],e.answers[i],i+1,(e.times&&e.times[i])||0)).join("");
}
