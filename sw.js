// Itineris 的 Service Worker：把 App 本身的檔案存在手機上，沒網路也打得開（第 7 步 PWA，D-069）
// 資料（行程、預算）不在這裡處理，由 Firestore 自己的離線快取負責。
//
// 策略：
//   App 自己的檔案（HTML、JS、CSS、圖）：先抓網路（部署後馬上拿到新版），沒網路才用存起來的
//   Firebase SDK、字型檔（網址帶版本、不會變）：直接用存起來的
//   Google 字型的 CSS：先用存起來的，背景再更新
//   Firestore／登入 API、Firebase 的 /__/ 登入頁、非 GET：完全不碰

const VERSION = 'v1';
const CACHE = `itineris-${VERSION}`;
const SHELL = [
  './',
  './index.html',
  './css/style.css',
  './js/app.js',
  './js/data.js',
  './js/firebase-config.js',
  './manifest.webmanifest',
  './assets/logo-wordmark.png',
  './assets/logo-wordmark-dark.png',
  './assets/icons/icon-192.png',
  './assets/icons/apple-touch-icon.png',
  './assets/icons/favicon-32.png',
  'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js',
  'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js',
  'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js',
];
const NETWORK_TIMEOUT = 4000; // 網路太慢（例如機場的 Wi-Fi）就先用存起來的

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  // 換版本時刪掉舊的快取
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('itineris-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function networkFirst(request, fallbackUrl) {
  const cache = await caches.open(CACHE);
  try {
    const response = await Promise.race([
      fetch(request),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), NETWORK_TIMEOUT)),
    ]);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return (await cache.match(request, { ignoreSearch: true }))
      || (fallbackUrl && await cache.match(fallbackUrl))
      || Response.error();
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok || response.type === 'opaque') cache.put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  const update = fetch(request).then((response) => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => hit);
  return hit || update;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.origin === self.location.origin) {
    if (url.pathname.startsWith('/__/')) return; // Firebase 的登入頁
    if (request.mode === 'navigate') {
      event.respondWith(networkFirst(request, './index.html'));
      return;
    }
    event.respondWith(networkFirst(request));
    return;
  }
  if (url.hostname === 'www.gstatic.com' && url.pathname.startsWith('/firebasejs/')) {
    event.respondWith(cacheFirst(request));
    return;
  }
  if (url.hostname === 'fonts.gstatic.com') {
    event.respondWith(cacheFirst(request));
    return;
  }
  if (url.hostname === 'fonts.googleapis.com') {
    event.respondWith(staleWhileRevalidate(request));
  }
  // 其他（Firestore、登入 API、Google 頭像）交給瀏覽器照常處理
});
