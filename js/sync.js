/* ============================================================
   ASTB-E Prep — sync.js
   Supabase 실시간 동기화 (AFOQT Master 동기화 계층 이식, 테이블만 astb_*)
   - 로그인 없이 '동기화 코드(user_key)'로 데이터를 구분한다.
   - 첫 pull이 성공하기 전에는 절대 업로드하지 않는다(새 데이터 덮어쓰기 방지).
   - 테이블별로 독립 push, 성공한 행만 큐에서 지운다(실패는 재시도).
   ============================================================ */
"use strict";

const TBL = {app:"astb_app_state", daily:"astb_daily_log", settings:"astb_settings"};
let sb=null, syncReady=false, syncInitialSettled=false;
let syncSessionCode="", syncSessionUrl="", syncSessionKey="";
let realtimeChan=null, realtimeReady=false, realtimeCode="";
let sbLibPromise=null, pullRetryTimer=null, pullRetryCount=0, pullRetryInFlight=null, syncInitializing=false, forceSyncRunning=false;
let settingsSyncUpdatedAt=0, serverDayTimes=new Map();

function genCode(){ const r=(crypto.randomUUID?crypto.randomUUID():Math.random().toString(36).slice(2)+Math.random().toString(36).slice(2)).replace(/-/g,""); return "astb-"+r.slice(0,16); }
function syncCode(){ let c=localStorage.getItem(LS.code); if(!c){ c=genCode(); localStorage.setItem(LS.code,c); } return c; }
// 이 페이지 수명 동안은 부팅 때 읽은 코드에 묶는다(다른 탭이 코드를 바꿔도 옛 상태를 새 계정에 올리지 않게)
function boundSyncCode(){ return syncSessionCode||syncCode(); }
function syncCodeChangedElsewhere(){ try{ return !!syncSessionCode&&localStorage.getItem(LS.code)!==syncSessionCode; }catch{ return false; } }
function sbUrl(){ return localStorage.getItem(LS.url)||CFG.SUPABASE_URL||""; }
function sbKey(){ return localStorage.getItem(LS.key)||CFG.SUPABASE_ANON_KEY||""; }
function bindSyncSession(){ syncSessionCode=syncCode(); syncSessionUrl=sbUrl(); syncSessionKey=sbKey(); }
function setSyncDot(s){ const d=$("#syncDot"); if(d) d.className="sync-dot "+s;
  const txt={on:`✅ 연결됨 · 코드 ${boundSyncCode()}`,syncing:"⏳ 기기 간 진도를 맞추는 중…",off:"오프라인 모드 (이 기기에만 저장)",err:"⚠️ 동기화 오류 — 연결 상태 또는 Supabase 테이블(schema.sql) 확인"}[s];
  const t=$("#syncStatusText"); if(t) t.textContent=txt; }
function syncRetryDelay(ms){ return Math.round(ms*(0.8+Math.random()*0.4)); }
function syncTime(x){ const n=Date.parse(x); return Number.isNaN(n)?0:n; }

function loadSupabase(){
  if(window.supabase) return Promise.resolve(window.supabase);
  if(navigator.onLine===false) return Promise.reject(new Error("offline"));
  if(sbLibPromise) return sbLibPromise;
  sbLibPromise=new Promise((resolve,reject)=>{ const s=document.createElement("script");
    s.src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"; s.async=true;
    s.onload=()=>resolve(window.supabase); s.onerror=()=>reject(new Error("supabase cdn failed"));
    document.head.appendChild(s); setTimeout(()=>reject(new Error("supabase cdn timeout")),12000); });
  return sbLibPromise;
}
async function initSync(){ if(syncInitializing) return false; syncInitializing=true;
  try{ return await initSyncRun(); } finally{ syncInitializing=false; syncInitialSettled=true; if(state) softRender(); } }
async function initSyncRun(){
  if(!syncSessionUrl||!syncSessionKey){ setSyncDot("off"); return; }
  setSyncDot("syncing");
  let lib; try{ lib=await loadSupabase(); }catch(e){ console.warn("sync offline:",e.message); sbLibPromise=null; setSyncDot("off"); return; }
  if(!lib){ setSyncDot("off"); return; }
  try{ sb=lib.createClient(syncSessionUrl,syncSessionKey,{realtime:{params:{eventsPerSecond:5}}}); syncReady=false; settingsSyncUpdatedAt=0;
    const pulled=await pullAll();
    if(!pulled){ subscribeRealtime(); schedulePullRetry(); setSyncDot("err"); return; }
    const subscribed=await subscribeRealtime(); syncReady=true; pullRetryCount=0; clearTimeout(pullRetryTimer); pullRetryTimer=null;
    const pushed=await pushAllLocal(); setSyncDot(pushed&&subscribed?"on":"err");
  }catch(e){ console.error(e); syncReady=false; sb=null; setSyncDot("err"); }
}
function schedulePullRetry(){ if(!sb||syncReady||pullRetryTimer||pullRetryInFlight) return;
  const steps=[15000,60000,300000], idx=Math.min(pullRetryCount,steps.length-1);
  pullRetryCount=Math.min(idx+1,steps.length-1);
  pullRetryTimer=setTimeout(()=>{ pullRetryTimer=null; retryInitialPull(); },syncRetryDelay(steps[idx])); }
async function retryInitialPull(){ if(!sb||syncReady||syncInitializing||forceSyncRunning) return syncReady; if(pullRetryInFlight) return pullRetryInFlight;
  setSyncDot("syncing"); pullRetryInFlight=(async()=>{ if(!await pullAll()) return false;
    const subscribed=await subscribeRealtime(); syncReady=true; pullRetryCount=0;
    const pushed=await pushAllLocal(); setSyncDot(pushed&&subscribed?"on":"err"); return pushed; })();
  try{ return await pullRetryInFlight; } finally{ pullRetryInFlight=null; if(!syncReady) schedulePullRetry(); softRender(); } }

async function pullDailyRows(code){ const pageSize=1000, out=[];
  for(let from=0;;from+=pageSize){ const r=await sb.from(TBL.daily).select("*").eq("user_key",code).order("day",{ascending:true}).range(from,from+pageSize-1);
    if(r.error) return r; const rows=r.data||[]; out.push(...rows); if(rows.length<pageSize) return {data:out,error:null}; } }
async function pullAll(){
  if(!sb||syncCodeChangedElsewhere()) return false; const code=boundSyncCode();
  try{
    const [dl,st,as]=await Promise.all([pullDailyRows(code),
      sb.from(TBL.settings).select("*").eq("user_key",code).maybeSingle(),
      sb.from(TBL.app).select("*").eq("user_key",code).maybeSingle()]);
    const ok=![dl,st,as].some(r=>r&&r.error);
    if(!ok){ console.error("pull partial fail",dl.error||st.error||as.error); setSyncDot("err"); }
    if(!dl.error) serverDayTimes=new Map((dl.data||[]).map(r=>[r.day,syncTime(r.updated_at)]));
    if(dl.data) dl.data.forEach(mergeDaily);
    if(st.data) mergeSettings(st.data);
    if(as.data&&as.data.data) mergeMisc(as.data.data);
    if(!as.error) miscPulledAt=Date.now();
    saveLocal(false); softRender(); return ok;
  }catch(e){ console.error("pull fail",e); setSyncDot("err"); return false; }
}
function mergeDaily(r){ const cur=state.daily[r.day];
  if(!cur||syncTime(r.updated_at)>syncTime(cur.updated_at)){ state.daily[r.day]={studied:r.studied,correct:r.correct,seconds:r.seconds,goal_met:r.goal_met,updated_at:r.updated_at}; return true; }
  return false; }
const SETTING_KEYS=["phase","p2start","hide_ko","no_back","terms_per_day","onboard_done"];
function mergeSettings(r){ const rt=syncTime(r.updated_at); if(rt&&rt<=settingsSyncUpdatedAt) return false; if(rt) settingsSyncUpdatedAt=rt;
  state.settings.exam_date=r.exam_date||"";
  if(r.data) for(const k of SETTING_KEYS) if(r.data[k]!=null) state.settings[k]=r.data[k];
  return true; }
// 시험 상세(items)는 크기 때문에 기기에만 두고 요약만 동기화한다.
function syncedExamHistory(){ return state.examHist.map(h=>{ if(!h||!h.items) return h; const s={...h}; delete s.items; return s; }); }
function miscBlob(){ return {exams:state.exams, examHist:syncedExamHistory(), wrongs:state.wrongs, reasonLog:state.reasonLog, weak:state.weak,
  secAcc:state.secAcc, qSeen:state.qSeen, speed:state.speed, first5:state.first5, terms:state.terms, pbmLog:state.pbmLog,
  realScores:state.realScores, checklist:state.checklist, dayStats:state.dayStats}; }
function mergeMisc(d){
  if(!d) return;
  for(const k in (d.exams||{})){ const r=d.exams[k], c=state.exams[k];
    if(!c){ state.exams[k]={...r}; continue; }
    const m={...c}, remoteBest=(r.best||0)/(r.bestTotal||1)>(c.best||0)/(c.bestTotal||1);
    if(remoteBest){ m.best=r.best; m.bestTotal=r.bestTotal; }
    if(syncTime(r.updated_at)>syncTime(c.updated_at)){ m.last=r.last; m.lastTotal=r.lastTotal; m.date=r.date; m.updated_at=r.updated_at; }
    state.exams[k]=m; }
  // 카운터: 표본이 더 많은 쪽 유지 (재동기화 중복 합산 방지)
  const richer=(a,b)=>((b?.c||0)+(b?.w||0))>((a?.c||0)+(a?.w||0));
  for(const k in (d.secAcc||{})) if(richer(state.secAcc[k],d.secAcc[k])) state.secAcc[k]=d.secAcc[k];
  const rt=(d.weak||{}).topic||{}; for(const k in rt) if(richer(state.weak.topic[k],rt[k])) state.weak.topic[k]=rt[k];
  for(const k in (d.first5||{})){ const r=d.first5[k], c=state.first5[k]; if(!c||(r.n||0)>(c.n||0)) state.first5[k]=r; }
  for(const k in (d.speed||{})){ const r=d.speed[k], c=state.speed[k]; if(!c||(r.n||0)>(c.n||0)) state.speed[k]=r; }
  for(const s of SUBS){ const rs=(d.qSeen||{})[s]||{}, cs=state.qSeen[s]||(state.qSeen[s]={}); for(const id in rs) cs[id]=Math.max(cs[id]||0,rs[id]||0); }
  // 오답노트: 항목별 최신(u) 우선 — 졸업(cleared) 툼스톤도 같이 전파된다
  for(const id in (d.wrongs||{})){ const r=d.wrongs[id], c=state.wrongs[id]; if(!c||(r.u||0)>(c.u||0)) state.wrongs[id]=r; }
  const rk=new Set(state.reasonLog.map(x=>x.id+"|"+x.d));
  for(const x of (d.reasonLog||[])) if(!rk.has(x.id+"|"+x.d)){ state.reasonLog.push(x); rk.add(x.id+"|"+x.d); }
  const seen=new Set(state.examHist.map(x=>x.ts));
  for(const x of (d.examHist||[])) if(!seen.has(x.ts)){ state.examHist.push(x); seen.add(x.ts); }
  state.examHist.sort((a,b)=>a.ts-b.ts); if(state.examHist.length>200) state.examHist=state.examHist.slice(-200);
  for(const id in (d.terms||{})){ const r=d.terms[id], c=state.terms[id]; if(!c||syncTime(r.updated_at)>syncTime(c.updated_at)) state.terms[id]=r; }
  for(const key of ["pbmLog","realScores"]){ const byId=new Map((state[key]||[]).map(x=>[x.id,x]));
    for(const x of (d[key]||[])){ const c=byId.get(x.id); if(!c) byId.set(x.id,x); else if(x.del&&!c.del) byId.set(x.id,{...c,del:1}); }
    state[key]=[...byId.values()].sort((a,b)=>String(a.date).localeCompare(String(b.date))||String(a.id).localeCompare(String(b.id))); }
  for(const day in (d.checklist||{})) state.checklist[day]=Object.assign(state.checklist[day]||{},d.checklist[day]);
  for(const day in (d.dayStats||{})){ const r=d.dayStats[day], c=state.dayStats[day]||(state.dayStats[day]={}); for(const k in r) c[k]=Math.max(c[k]||0,r[k]||0); }
}

function subscribeRealtime(){
  if(!sb||syncCodeChangedElsewhere()) return Promise.resolve(false); const code=boundSyncCode();
  if(realtimeChan&&realtimeCode===code&&realtimeReady) return Promise.resolve(true);
  if(realtimeChan) sb.removeChannel(realtimeChan); realtimeReady=false; realtimeCode=code;
  const channel=sb.channel("astb-"+code)
    .on("postgres_changes",{event:"*",schema:"public",table:TBL.daily,filter:`user_key=eq.${code}`},p=>{ if(p.new) handleDailyRealtime(p.new); })
    .on("postgres_changes",{event:"*",schema:"public",table:TBL.settings,filter:`user_key=eq.${code}`},p=>{ if(p.new&&mergeSettings(p.new)){ saveLocal(false); softRender(); } });
  // ⚠️ 큰 진도 덩어리(astb_app_state)는 실시간 구독하지 않는다. 쓸 때마다 전체 행이 모든 구독 기기로
  //    다시 전송돼 Supabase 무료 한도의 전송량(Egress)을 빠르게 쓴다. 대신 앱을 다시 볼 때 pullMiscIfStale()로 받는다.
  realtimeChan=channel;
  return new Promise(resolve=>{ let settled=false; const finish=ok=>{ if(settled) return; settled=true; clearTimeout(timer); resolve(ok); };
    const timer=setTimeout(()=>finish(false),8000);
    channel.subscribe(status=>{ if(realtimeChan!==channel) return;
      if(status==="SUBSCRIBED"){ realtimeReady=true; finish(true); }
      else if(["CHANNEL_ERROR","TIMED_OUT","CLOSED"].includes(status)){ realtimeReady=false; finish(false); } }); });
}
let miscPulledAt=0, miscPullInFlight=null;
async function pullMiscIfStale(minGapMs=60000){
  if(!sb||!syncReady||syncCodeChangedElsewhere()||document.visibilityState==="hidden") return false;
  if(miscPullInFlight) return miscPullInFlight; if(Date.now()-miscPulledAt<minGapMs) return false;
  miscPullInFlight=(async()=>{ try{ const r=await sb.from(TBL.app).select("data,updated_at").eq("user_key",boundSyncCode()).maybeSingle();
      if(r.error) throw r.error; miscPulledAt=Date.now();
      if(r.data&&r.data.data&&!ownAppStateUpdates.has(syncTime(r.data.updated_at))){ mergeMisc(r.data.data); if(pushQ.app) pushQ.app.data=miscBlob(); saveLocal(false); softRender(); }
      return true; }catch(e){ console.warn("app_state pull failed",e); return false; } finally{ miscPullInFlight=null; } })();
  return miscPullInFlight; }
function handleDailyRealtime(r){ const t=syncTime(r.updated_at); if(t>(serverDayTimes.get(r.day)||0)) serverDayTimes.set(r.day,t);
  const changed=mergeDaily(r), cur=state.daily[r.day], pending=pushQ.daily.get(r.day);
  if(changed){ if(pending&&syncTime(pending.updated_at)<=t) queuePush("daily_log",{day:r.day,...cur}); saveLocal(false); softRender(); }
  else if(cur&&syncTime(cur.updated_at)>t) queuePush("daily_log",{day:r.day,...cur}); }

/* ---------- push queue ---------- */
const pushQ={daily:new Map(), settings:null, app:null};
let pushTimer=null, pushDueAt=0, pushInFlight=null, pushRetryCount=0, pushRetryAt=0;
const ownAppStateUpdates=new Set();
function rememberOwnAppState(ts){ ownAppStateUpdates.add(syncTime(ts)); while(ownAppStateUpdates.size>200) ownAppStateUpdates.delete(ownAppStateUpdates.values().next().value); }
function hasPendingPush(){ return pushQ.daily.size||pushQ.settings||pushQ.app; }
function pendingPushDelay(){ return 6000; }      // 연속 학습 중 최대 6초에 한 번 — 숨김/종료 시엔 즉시 flush
function schedulePush(ms){ if(!syncReady) return; const due=Math.max(Date.now()+ms,pushRetryAt||0);
  if(pushTimer&&pushDueAt<=due) return;
  clearTimeout(pushTimer); pushDueAt=due; pushTimer=setTimeout(()=>{ pushTimer=null; pushDueAt=0; flushPush(); },Math.max(0,due-Date.now())); }
function queuePush(table,row){ if(!sb||suppressPersistence||syncCodeChangedElsewhere()) return; const code=boundSyncCode();
  if(table==="app_state") pushQ.app={user_key:code,data:miscBlob(),updated_at:nowISO()};
  else if(table==="daily_log") pushQ.daily.set(row.day,{user_key:code,day:row.day,studied:row.studied||0,correct:row.correct||0,seconds:row.seconds||0,goal_met:!!row.goal_met,updated_at:row.updated_at||nowISO()});
  else if(table==="settings"){ const updated_at=nowISO(); settingsSyncUpdatedAt=syncTime(updated_at);
    pushQ.settings={user_key:code,exam_date:state.settings.exam_date||null,
      data:Object.fromEntries(SETTING_KEYS.map(k=>[k,state.settings[k]])),updated_at}; }
  if(!pushInFlight) schedulePush(pendingPushDelay()); }
async function flushPushPass(){ let ok=true;
  if(pushQ.daily.size){ const entries=[...pushQ.daily.entries()];
    try{ await sb.from(TBL.daily).upsert(entries.map(x=>x[1]),{onConflict:"user_key,day"}).throwOnError();
      entries.forEach(([k,row])=>{ serverDayTimes.set(k,syncTime(row.updated_at)); if(pushQ.daily.get(k)===row) pushQ.daily.delete(k); }); }
    catch(e){ console.error("push daily fail",e); setSyncDot("err"); ok=false; } }
  if(pushQ.settings){ const r=pushQ.settings;
    try{ await sb.from(TBL.settings).upsert(r,{onConflict:"user_key"}).throwOnError(); if(pushQ.settings===r) pushQ.settings=null; }
    catch(e){ console.error("push settings fail",e); setSyncDot("err"); ok=false; } }
  if(pushQ.app){ const r=pushQ.app; rememberOwnAppState(r.updated_at);
    try{ await sb.from(TBL.app).upsert(r,{onConflict:"user_key"}).throwOnError(); if(pushQ.app===r) pushQ.app=null; }
    catch(e){ console.error("push app_state fail",e); setSyncDot("err"); ok=false; } }
  return ok; }
async function flushPush(){ if(!sb||!syncReady||suppressPersistence||syncCodeChangedElsewhere()) return false;
  clearTimeout(pushTimer); pushTimer=null; pushDueAt=0;
  if(pushInFlight) return pushInFlight;
  let result=false;
  pushInFlight=(async()=>{ const ok=await flushPushPass(); if(ok) setSyncDot("on"); return ok; })();
  try{ result=await pushInFlight; return result; }
  finally{ pushInFlight=null;
    if(result){ pushRetryCount=0; pushRetryAt=0; if(hasPendingPush()) schedulePush(pendingPushDelay()); }
    else if(hasPendingPush()){ const delays=[2000,5000,15000,60000], idx=Math.min(pushRetryCount,delays.length-1);
      pushRetryCount=Math.min(idx+1,delays.length-1); pushRetryAt=Date.now()+syncRetryDelay(delays[idx]); schedulePush(0); } } }
// pull 직후 호출: 서버보다 새로운 로컬 행만 올려 '앱을 닫아 못 올라간 진도'를 치유한다.
function pushAllLocal(){ if(!sb||!syncReady) return Promise.resolve(false);
  pushQ.daily.clear(); pushQ.settings=null; pushQ.app=null;
  for(const day in state.daily){ const d=state.daily[day]; if(!serverDayTimes.has(day)||syncTime(d.updated_at)>serverDayTimes.get(day)) queuePush("daily_log",{day,...d}); }
  queuePush("settings",{}); queuePush("app_state"); return flushPush(); }
async function forceSync(){
  if(!sb){ toast("오프라인 모드예요. 동기화 설정(Supabase)을 확인하세요."); return; }
  if(syncInitializing||forceSyncRunning){ toast("동기화 연결 중… 잠시 후 다시 눌러주세요."); return; }
  forceSyncRunning=true; setSyncDot("syncing"); toast("동기화 중…");
  try{ if(pullRetryInFlight) await pullRetryInFlight; if(pushInFlight) await pushInFlight;
    clearTimeout(pullRetryTimer); pullRetryTimer=null; syncReady=false; clearTimeout(pushTimer); pushTimer=null; pushDueAt=0; pushRetryCount=0; pushRetryAt=0;
    if(!await pullAll()) throw new Error("pull failure");
    const subscribed=await subscribeRealtime(); syncReady=true; pullRetryCount=0;
    const pushed=await pushAllLocal(); if(!pushed||!subscribed) throw new Error("sync failure");
    const solved=Object.values(state.secAcc).reduce((t,o)=>t+(o.c||0)+(o.w||0),0);
    toast(`✅ 동기화 완료 · 풀이 ${solved}문제 · 오답 ${activeWrongs().length} · 시험 ${state.examHist.length}회`,3500);
  }catch(e){ if(!syncReady) schedulePullRetry(); toast("동기화 실패 — 연결 상태나 Supabase 테이블을 확인하세요"); setSyncDot("err"); }
  finally{ forceSyncRunning=false; softRender(); } }
