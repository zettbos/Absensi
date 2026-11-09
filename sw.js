/**
 * ================================================================================
 * SW.JS - FULL-FEATURED SERVICE WORKER UNTUK PWABUILDER.COM & GITHUB PAGES
 * Sistem Absensi Siswa Cerdas
 * ================================================================================
 * Mendukung penuh seluruh indikator penilaian PWABuilder:
 * 1. Has Service Worker & Has Logic
 * 2. Offline Support (Network-First + Fallback Cache)
 * 3. Background Sync ('sync' event listener)
 * 4. Periodic Sync ('periodicsync' event listener)
 * 5. Push Notifications ('push' & 'notificationclick' event listeners)
 * ================================================================================
 */

const CACHE_NAME = 'absensi-siswa-pwa-v1.4.0';
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './widgets/absensi-template.json',
  './widgets/absensi-data.json'
];

// 1. INSTALL: Pre-cache aset inti
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// 2. ACTIVATE: Bersihkan cache versi lama
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

// 3. FETCH: Network-First dengan Fallback Offline (Bypass penuh untuk API Google Apps Script & Drive)
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (
    req.method !== 'GET' ||
    url.hostname.includes('script.google.com') ||
    url.hostname.includes('googleusercontent.com') ||
    url.hostname.includes('drive.google.com')
  ) {
    return;
  }

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

// 4. BACKGROUND SYNC: Sinkronisasi antrean presensi saat koneksi internet kembali stabil
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-presensi' || event.tag === 'absensi-background-sync') {
    event.waitUntil(
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: 'BACKGROUND_SYNC_TRIGGERED',
            tag: event.tag
          });
        });
      })
    );
  }
});

// 5. PERIODIC SYNC: Pembaruan berkala data ringkasan dashboard
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'update-absensi-dashboard' || event.tag === 'content-sync') {
    event.waitUntil(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.add('./index.html');
      })
    );
  }
});

// 6. PUSH NOTIFICATIONS: Penanganan notifikasi pengingat jam absen masuk/pulang
self.addEventListener('push', (event) => {
  let payload = {
    title: 'Pengingat Absensi Siswa',
    body: 'Jangan lupa melakukan presensi selfie & GPS hari ini.',
    url: './index.html?tab=kamera'
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      payload = Object.assign(payload, parsed);
    } catch (e) {
      payload.body = event.data.text() || payload.body;
    }
  }

  const options = {
    body: payload.body,
    icon: './icons/icon-192.png',
    badge: './icons/icon-192.png',
    vibrate: [100, 50, 100],
    data: {
      url: payload.url || './index.html'
    },
    actions: [
      { action: 'open_camera', title: 'Buka Kamera Absen' },
      { action: 'open_dashboard', title: 'Lihat Dashboard' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(payload.title, options)
  );
});

// 7. NOTIFICATION CLICK: Buka tab kamera atau dashboard saat notifikasi diketuk
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = (event.action === 'open_camera')
    ? './index.html?tab=kamera'
    : ((event.notification.data && event.notification.data.url) ? event.notification.data.url : './index.html');

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if ('focus' in client) {
          client.focus();
          return;
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
