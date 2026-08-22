const CACHE='sinbad-marine-v8.20.17-live-character-gesture-intent-v17';
const ASSETS=[
  './',
  './index.html',
  './academy.html',
  './academy.css',
  './academy-window.js',
  './styles.css',
  './app.js',
  './sinbad-character-engine.js',
  './sinbad-performance-director.js',
  './sinbad-character-rig.js',
  './pilot-data.js',
  './route-data.js',
  './official-publications.js',
  './supabase/functions/sinbad-answer/core-decision.js',
  './sinbad-core.js',
  './sinbad-navigation.js',
  './sinbad-navigation-assistant.js',
  './sinbad-route-visualizer.js',
  './sinbad-training-data.js',
  './sinbad-academy.js',
  './vendor/ol-10.6.1.js',
  './vendor/ol-10.6.1.css',
  './vendor/land-110m.json',
  './vendor/supabase-2.112.3.js',
  './vendor/mammoth-1.12.1.min.js',
  './vendor/tesseract-5.1.1.min.js',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './assets/captain-sinbad/captain-sinbad-idle-master.png',
  './assets/captain-sinbad/captain-sinbad-idle-blink-v1.png',
  './assets/captain-sinbad/captain-sinbad-listening.png',
  './assets/captain-sinbad/captain-sinbad-thinking.png',
  './assets/captain-sinbad/captain-sinbad-speaking.png',
  './assets/captain-sinbad/captain-sinbad-speaking-mbp-v1.png',
  './assets/captain-sinbad/captain-sinbad-speaking-o-v1.png',
  './assets/captain-sinbad/captain-sinbad-laughing-v1.png',
  './assets/captain-sinbad/captain-sinbad-walk-a-v1.png',
  './assets/captain-sinbad/captain-sinbad-walk-b-v1.png',
  './assets/captain-sinbad/captain-sinbad-writing-contact-v1.png',
  './assets/captain-sinbad/captain-sinbad-writing-lift-v1.png',
  './assets/captain-sinbad/captain-sinbad-board-teaching.png'
];

self.addEventListener('install',event=>{
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));
});

self.addEventListener('activate',event=>{
  event.waitUntil(Promise.all([
    self.clients.claim(),
    caches.keys().then(keys=>Promise.all(
      keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))
    ))
  ]));
});

self.addEventListener('fetch',event=>{
  const request=event.request;
  const url=new URL(request.url);

  // Supabase/API requests must never receive the app's HTML fallback.
  if(request.method!=='GET' || url.origin!==self.location.origin){
    return;
  }

  if(request.mode==='navigate'){
    const pageKey=url.pathname.endsWith('/academy.html')?'./academy.html':'./index.html';
    event.respondWith(
      fetch(request)
        .then(response=>{
          const copy=response.clone();
          caches.open(CACHE).then(cache=>cache.put(pageKey,copy));
          return response;
        })
        .catch(()=>caches.match(pageKey))
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then(response=>{
        const copy=response.clone();
        caches.open(CACHE).then(cache=>cache.put(request,copy));
        return response;
      })
      .catch(()=>caches.match(request))
  );
});
