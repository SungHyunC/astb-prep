/* ============================================================
   ASTB-E Prep — boot.js
   서비스워커 등록/강제 업데이트 · 부팅. 최상위 실행문은 이 파일에만 둔다.
   ============================================================ */
"use strict";

// 같은 origin의 AFOQT 앱을 건드리지 않도록: 내 등록만 해제하고 astb- 캐시만 지운다.
async function forceUpdate(){
  toast("최신 버전을 받는 중…");
  try{ saveNow();
    if(sb&&syncReady&&hasPendingPush()) await Promise.race([flushPush(),new Promise(r=>setTimeout(r,1800))]);
    if("serviceWorker" in navigator){ const reg=await navigator.serviceWorker.getRegistration(); if(reg) await reg.unregister(); }
    if(window.caches){ const ks=await caches.keys(); await Promise.all(ks.filter(k=>k.startsWith("astb-")).map(k=>caches.delete(k))); }
  }catch(e){ console.warn(e); }
  const u=new URL(location.href); u.searchParams.set("v",Date.now().toString()); location.replace(u.toString());
}
function showUpdBanner(){
  if($("#updBanner")) return;
  const b=document.createElement("button"); b.id="updBanner"; b.innerHTML=`🔄 새 버전 준비 완료 — <b>탭해서 적용</b>`;
  b.onclick=()=>{ b.disabled=true; b.textContent="적용 중…"; location.reload(); }; document.body.appendChild(b);
}
function registerSW(){
  if(!("serviceWorker" in navigator)) return;
  // 로컬 개발(localhost)에서는 캐시가 수정본을 가리지 않도록 등록하지 않는다. (?sw=1 이면 강제 등록)
  if(/^(localhost|127\.0\.0\.1)$/.test(location.hostname) && !/[?&]sw=1/.test(location.search)){
    navigator.serviceWorker.getRegistration().then(r=>r&&r.unregister()).catch(()=>{}); return; }
  let reloaded=false;
  // 새 SW가 제어권을 잡으면 새로고침 — 단, 시험·카드 도중엔 끝날 때까지 미룬다.
  navigator.serviceWorker.addEventListener("controllerchange",()=>{ if(reloaded) return; showUpdBanner();
    const tryReload=()=>{ if(sessionActive()){ setTimeout(tryReload,4000); return; } reloaded=true; location.reload(); }; tryReload(); });
  navigator.serviceWorker.register("./sw.js",{scope:"./"}).then(reg=>{
    reg.update(); setInterval(()=>reg.update(),60*60*1000);
    reg.addEventListener("updatefound",()=>{ const nw=reg.installing; if(!nw) return;
      nw.addEventListener("statechange",()=>{ if(nw.state==="installed"&&navigator.serviceWorker.controller) nw.postMessage&&nw.postMessage("skip-waiting"); }); });
  }).catch(()=>{});
}
async function boot(){
  try{
    loadLocal(); bindSyncSession(); wire();
    const ok=await loadData();
    if(!ok){ $("#boot").innerHTML="<p class='center'>문제 데이터를 불러오지 못했어요.<br>네트워크를 확인하고 새로고침 해주세요.</p>"+
        "<button class='btn primary' style='max-width:200px;margin:16px auto;display:flex' onclick='location.reload()'>새로고침</button>"; return; }
    registerPresets();
    $("#boot").classList.remove("active"); go("home");
    maybeOnboard();
    initSync();       // 비동기 — 앱은 이미 사용 가능
    registerSW();
  }catch(e){
    console.error("boot failed:",e);
    $("#boot").innerHTML="<p class='center'>앱 로딩 중 오류가 발생했어요.<br>새로고침 해주세요.</p>"+
      "<button class='btn primary' style='max-width:200px;margin:16px auto;display:flex' onclick='location.reload()'>새로고침</button>";
  }
}
boot();
