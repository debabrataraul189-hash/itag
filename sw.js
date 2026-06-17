// iTubeTag service worker — v3
// Strategy:
//   • HTML pages: NETWORK-FIRST (always get the latest UI; fall back to cache offline)
//   • Static assets (images / fonts / sw): CACHE-FIRST
// This prevents the "stuck on old HTML" bug that hit the first APK installs.

const CACHE = 'itubetag-v3';
const ASSET_EXT = /\.(png|jpg|jpeg|webp|svg|gif|ico|woff2?|ttf|eot|css|mp3|mp4|json)$/i;

self.addEventListener('install', e => {
  // Don't preload index.html — keep it network-first.
  e.waitUntil(caches.open(CACHE).then(c => c.addAll([
    './manifest.json',
    './icons/icon-192.png',
    './icons/icon-512.png'
  ])).catch(()=>{}));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Always skip caching of API / Razorpay / cross-origin payment endpoints.
  if (url.pathname.startsWith('/api/') ||
      url.host.includes('razorpay.com') ||
      url.host.includes('googleapis.com')) {
    return;
  }

  const isHtml = req.mode === 'navigate' ||
                 (req.headers.get('accept') || '').includes('text/html');

  if (isHtml) {
    // Network-first for HTML
    e.respondWith(
      fetch(req).then(resp => {
        const clone = resp.clone();
        caches.open(CACHE).then(c => c.put(req, clone));
        return resp;
      }).catch(() => caches.match(req).then(c => c || caches.match('./index.html')))
    );
    return;
  }

  if (ASSET_EXT.test(url.pathname)) {
    // Cache-first for static assets
    e.respondWith(
      caches.match(req).then(cached => cached || fetch(req).then(resp => {
        const clone = resp.clone();
        caches.open(CACHE).then(c => c.put(req, clone));
        return resp;
      }))
    );
    return;
  }
});
