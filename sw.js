const CACHE='sinbad-marine-v8.20.8-clone-conversation';
const ASSETS=[
  './',
  './index.html',
  './styles.css',
  './app.js',
  './pilot-data.js',
  './route-data.js',
  './official-publications.js',
  './sinbad-core.js',
  './sinbad-training-data.js',
  './sinbad-academy.js',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png'
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
    event.respondWith(
      fetch(request)
        .then(response=>{
          const copy=response.clone();
          caches.open(CACHE).then(cache=>cache.put('./index.html',copy));
          return response;
        })
        .catch(()=>caches.match('./index.html'))
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
