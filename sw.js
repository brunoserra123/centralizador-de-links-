const CACHE_NAME = 'linkvault-v2';
const urlsToCache = [
  './',
  './index.html',
  './styles.css',
  './script.js',
  './config.js',
  './config.local.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', event => {
  // Para a API do GitHub ou links.csv, tentar a rede sempre e não interferir
  if (event.request.url.includes('api.github.com') || event.request.url.includes('links.csv')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        // Fallback básico para offline (script.js já trata leitura offline local)
        return new Response('', { status: 404 });
      })
    );
    return;
  }

  // Para outros arquivos estáticos (HTML, CSS, JS), Cache-first com Fallback para Rede
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response; // Retorna do cache se existir
        }
        return fetch(event.request); // Busca na rede se não estiver no cache
      })
  );
});
