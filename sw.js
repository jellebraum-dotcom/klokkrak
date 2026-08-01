/* Klokkrak service worker — app-shell cache voor offline gebruik */
var CACHE = "klokkrak-v1";
var ASSETS = [
  "./", "index.html", "leerkracht.html", "klokkrak.css",
  "engine.js", "jsqr.js", "qrcode.js", "manifest.webmanifest",
  "icon-192.png", "icon-512.png", "icon-512-maskable.png", "apple-touch-icon.png"
];
self.addEventListener("install", function(e){
  e.waitUntil(caches.open(CACHE).then(function(c){ return c.addAll(ASSETS); }).then(function(){ return self.skipWaiting(); }));
});
self.addEventListener("activate", function(e){
  e.waitUntil(caches.keys().then(function(keys){
    return Promise.all(keys.filter(function(k){ return k!==CACHE; }).map(function(k){ return caches.delete(k); }));
  }).then(function(){ return self.clients.claim(); }));
});
self.addEventListener("fetch", function(e){
  if(e.request.method!=="GET") return;
  e.respondWith(caches.match(e.request).then(function(hit){
    return hit || fetch(e.request).then(function(resp){
      try{ if(resp && resp.status===200 && new URL(e.request.url).origin===location.origin){ var copy=resp.clone(); caches.open(CACHE).then(function(c){ c.put(e.request, copy); }); } }catch(_){}
      return resp;
    }).catch(function(){ return caches.match("./"); });
  }));
});
