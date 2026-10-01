/* ASTB-E Prep — Service Worker (오프라인 캐시)
   ⚠️ 배포마다 js/core.js의 VERSION과 이 CACHE를 함께 올린다. 새 파일은 ASSETS에 추가.
   같은 origin(sunghyunc.github.io)의 AFOQT 앱 캐시는 절대 지우지 않는다(astb- 접두사만 정리). */
const CACHE = "astb-v1-1-0";
const ASSETS = [
  "./", "./index.html", "./app.css", "./config.js",
  "./js/core.js", "./js/data.js", "./js/figures.js", "./js/score.js", "./js/cat.js", "./js/exam.js", "./js/sync.js", "./js/views.js", "./js/boot.js",
  "./data/meta.json", "./data/mst.json", "./data/rct.json", "./data/mct.json", "./data/anit.json",
  "./data/terms.json", "./data/topics.json", "./data/guides.json",
  "./data/mock_a.json", "./data/mock_b.json", "./data/mock_c.json",
  "./icon.svg", "./manifest.webmanifest",
];

self.addEventListener("install", e => {
  self.skipWaiting();
  // addAll은 하나만 실패해도 전체가 비므로 개별로 추가
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(ASSETS.map(a => c.add(a).catch(() => {})))));
});
self.addEventListener("message", e => { if (e.data === "skip-waiting") self.skipWaiting(); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith("astb-") && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;              // Supabase·CDN은 네트워크로
  const isShell = /\.(html|js|css)$/.test(url.pathname) || url.pathname.endsWith("/");
  if (isShell) {                                                   // 앱 셸: 네트워크 우선
    e.respondWith(fetch(req).then(res => {
      if (res && res.status >= 500) return caches.match(req).then(c => c || res);
      if (res && res.status === 200) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {}); }
      return res;
    }).catch(() => caches.match(req, {ignoreSearch: true}).then(m => m || new Response("offline", {status: 503}))));
    return;
  }
  e.respondWith(caches.match(req, {ignoreSearch: true}).then(cached => {   // 데이터: 캐시 우선 + 백그라운드 갱신
    const net = fetch(req).then(res => {
      if (res && res.status === 200) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {}); }
      return res;
    }).catch(() => cached || new Response("offline", {status: 503}));
    return cached || net;
  }));
});
