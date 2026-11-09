/**
 * ================================================================================
 * SW.JS - SERVICE WORKER UNTUK PWABUILDER.COM & GITHUB PAGES
 * Sistem Absensi Siswa Cerdas
 * ================================================================================
 * Strategi:
 * 1. Bypass penuh untuk seluruh request POST & API Google Apps Script / Google Drive.
 * 2. Network-First dengan Fallback Cache untuk aset statis (HTML, Manifest, Ikon)
 *    agar lolos 100% validasi Offline Capability di PWABuilder.com.
 * ================================================================================
 */

const CACHE_NAME = 'absensi-siswa-pwa-v1.3.0';
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 1. Jangan pernah cache request selain GET atau request ke API Google Apps Script / Drive
  if (
    req.method !== 'GET' ||
    url.hostname.includes('script.google.com') ||
    url.hostname.includes('googleusercontent.com') ||
    url.hostname.includes('drive.google.com')
  ) {
    return;
  }

  // 2. Network-First dengan Fallback ke Cache (dan fallback ke ./index.html untuk navigasi halaman)
  event.respondWith(
    fetch(req)
      .then((networkRes) => {
        if (networkRes && networkRes.status === 200 && url.origin === self.location.origin) {
          const resClone = networkRes.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(req, resClone);
          });
        }
        return networkRes;
      })
      .catch(() => {
        return caches.match(req).then((cachedRes) => {
          if (cachedRes) return cachedRes;
          if (req.mode === 'navigate') {
            return caches.match('./index.html');
          }
          return new Response('Mode Offline Aktif', {
            status: 503,
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }
          });
        });
      })
  );
});

