const CACHE_NAME = 'linkvault-v4';

// Arquivos que existem no site publicado (config.local.js NÃO entra: é ignorado pelo git e dá 404 no GitHub Pages)
const urlsToCache = [
  './',
  './index.html',
  './styles.css',
  './script.js',
  './config.js',
  './manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      // allSettled: um arquivo faltando não derruba a instalação inteira
      Promise.allSettled(urlsToCache.map(url => cache.add(url)))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(names => Promise.all(names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // API do GitHub e links.csv: sempre rede, sem cache
  if (url.hostname === 'api.github.com' || url.pathname.endsWith('links.csv')) {
    event.respondWith(
      fetch(req).catch(() => new Response('', { status: 404 }))
    );
    return;
  }

  // Só cuida de arquivos do próprio site; fontes/CDN seguem o fluxo normal do navegador
  if (url.origin !== self.location.origin) return;

  // Network-first: sempre pega a versão nova quando online, e usa o cache só se estiver offline.
  // (Assim o site não fica preso em versões antigas.)
  event.respondWith(
    fetch(req)
      .then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then(hit => hit || caches.match('./index.html')))
  );
});
