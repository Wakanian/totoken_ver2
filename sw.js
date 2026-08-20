// ととけんクイズ ver.2 - Service Worker
// アプリを完全オフライン（機内モードなど）でも動かすためのキャッシュ管理

const CACHE_VERSION = 'tokoken-quiz-v2';
const CORE_CACHE = `${CACHE_VERSION}-core`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

// 起動時に必ずキャッシュしておく「アプリの骨格」
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-72.png',
  './icons/icon-96.png',
  './icons/icon-128.png',
  './icons/icon-144.png',
  './icons/icon-152.png',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
  // 外部CDN（Tailwind／Googleフォント）もここでキャッシュしておくと
  // 初回読み込み後はオフラインでもデザインが崩れない
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans+JP:wght@400;500;700&display=swap',
];

// インストール時：コアアセットを事前キャッシュ
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CORE_CACHE).then((cache) => {
      return Promise.all(
        CORE_ASSETS.map((url) =>
          fetch(url, { mode: url.startsWith('http') ? 'no-cors' : 'same-origin' })
            .then((res) => cache.put(url, res))
            .catch(() => {
              // 個別のURLでネットワークエラーが起きても全体のインストールは止めない
            })
        )
      );
    })
  );
});

// 有効化時：古いバージョンのキャッシュを削除
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith('tokoken-quiz-') && key !== CORE_CACHE && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// fetch時：キャッシュ優先 → なければネットワーク取得し、取得できたものは
// ランタイムキャッシュに保存して次回以降オフラインでも使えるようにする
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;

      return fetch(req)
        .then((res) => {
          const resClone = res.clone();
          caches.open(RUNTIME_CACHE).then((cache) => {
            cache.put(req, resClone).catch(() => {});
          });
          return res;
        })
        .catch(() => {
          // オフラインでキャッシュにも無い場合、HTMLナビゲーションなら
          // トップページ(index.html)を代わりに返す
          if (req.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
    })
  );
});
