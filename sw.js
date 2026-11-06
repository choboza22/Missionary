// 오프라인 대비: 네트워크 우선, 실패하면 저장된 파일 사용
const CACHE = 'rest-v1';
const CORE = ['./', 'index.html', 'css/style.css', 'js/config.js', 'js/data.js', 'js/app.js', 'js/jsQR.js'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); return r; }).catch(() => caches.match(e.request).then(m => m || caches.match('index.html'))));
});
