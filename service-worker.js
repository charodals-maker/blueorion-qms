const CACHE_NAME = 'blueorion-qms-cache-v1';
const urlsToCache = [
  '/',
  '/views/login.html',
  '/views/admin.html',
  '/views/qms_document_center.html',
  '/assets/style.css',
  '/assets/BLUEORION%20LOGO'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
  );
});
