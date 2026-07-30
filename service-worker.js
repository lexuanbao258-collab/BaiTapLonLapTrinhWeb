'use strict';

const CACHE_NAME = 'taskflow-v1.7.4';
const STATIC_ASSETS = [
  './',
  './index.html',
  './login.html',
  './register.html',
  './forgot-password.html',
  './profile.html',
  './tasks.html',
  './kanban.html',
  './calendar.html',
  './categories.html',
  './statistics.html',
  './about.html',
  './manifest.webmanifest',
  './assets/css/style.css',
  './assets/css/responsive.css',
  './assets/img/logo.svg',
  './assets/img/empty-state.svg',
  './assets/img/icon-192.png',
  './assets/img/icon-512.png',
  './assets/img/icon-maskable-512.png',
  './assets/js/core/config.js',
  './assets/js/core/theme-bootstrap.js',
  './assets/js/core/utils.js',
  './assets/js/core/storage.js',
  './assets/js/core/validators.js',
  './assets/js/components/icons.js',
  './assets/js/components/toast.js',
  './assets/js/components/modal.js',
  './assets/js/components/confirm-dialog.js',
  './assets/js/components/task-card.js',
  './assets/js/components/task-form.js',
  './assets/js/components/task-actions.js',
  './assets/js/components/ui-facade.js',
  './assets/js/services/auth-service.js',
  './assets/js/services/settings-service.js',
  './assets/js/services/activity-service.js',
  './assets/js/services/category-service.js',
  './assets/js/services/task-service.js',
  './assets/js/services/statistics-service.js',
  './assets/js/services/backup-service.js',
  './assets/js/services/workspace-service.js',
  './assets/js/services/csv-service.js',
  './assets/js/app.js',
  './assets/js/pages/auth-page.js',
  './assets/js/pages/profile-page.js',
  './assets/js/pages/dashboard-page.js',
  './assets/js/pages/tasks-page.js',
  './assets/js/pages/kanban-page.js',
  './assets/js/pages/calendar-page.js',
  './assets/js/pages/categories-page.js',
  './assets/js/pages/statistics-page.js',
  './assets/js/pages/settings-page.js',
  './assets/js/pages/about-page.js',
  './tests/mobile-interaction-check.html'
];

const isCacheable = response => {
  return response && response.status === 200 && response.type === 'basic';
};

const cacheResponse = async (request, response) => {
  if (!isCacheable(response)) {
    return response;
  }

  try {
    const cache = await caches.open(CACHE_NAME);

    await cache.put(request, response.clone());
  } catch (error) {
    console.warn('[TaskFlow] Không thể cập nhật cache:', request.url, error);
  }

  return response;
};

const offlineNavigationResponse = async () => {
  const fallback = await caches.match('./index.html');

  return fallback || new Response(
    '<html><body><h1>Đang ngoại tuyến</h1><p><a href="./">Tải lại</a></p></body></html>',
    {
      headers: {
        'Content-Type': 'text/html; charset=utf-8'
      }
    }
  );
};

const networkFirst = async request => {
  try {
    const response = await fetch(request);

    return cacheResponse(request, response);
  } catch (error) {
    const cachedResponse = await caches.match(request);

    if (cachedResponse) {
      return cachedResponse;
    }

    if (request.mode === 'navigate') {
      return offlineNavigationResponse();
    }

    return Response.error();
  }
};

const cacheFirst = async request => {
  const cachedResponse = await caches.match(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const response = await fetch(request);

    return cacheResponse(request, response);
  } catch (error) {
    return Response.error();
  }
};

const isFreshAppAsset = (request, url) => {
  const path = url.pathname;

  return request.mode === 'navigate' ||
    path.endsWith('.html') ||
    /\/assets\/js\/(?:[^/]+\/)*[^/]+\.js$/.test(path) ||
    /\/assets\/css\/[^/]+\.css$/.test(path) ||
    path.endsWith('/service-worker.js') ||
    path.endsWith('/manifest.webmanifest');
};

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => Promise.allSettled(
        STATIC_ASSETS.map(asset => cache.add(asset))
      ))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(cacheNames => Promise.all(
        cacheNames
          .filter(name => name.startsWith('taskflow-') && name !== CACHE_NAME)
          .map(name => caches.delete(name))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;

  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  // HTML, JavaScript, CSS, the manifest and the worker itself are always
  // checked against the network first so an old cache cannot pin old code.
  event.respondWith(
    isFreshAppAsset(request, url) ?
      networkFirst(request) :
      cacheFirst(request)
  );
});
