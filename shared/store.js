/* Campuspilot — shared localStorage JSON helpers. There's no backend
   yet, so each feature page's own data (lost & found items, job
   listings, course reviews, profile settings) is persisted here under
   a page-owned storage key, so it survives a real page reload or
   navigation instead of resetting every visit. */
function cpLoadJSON(key, fallback){
  try{
    var raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : (fallback !== undefined ? fallback : null);
  }catch(e){ return (fallback !== undefined ? fallback : null); }
}
function cpSaveJSON(key, value){
  try{ localStorage.setItem(key, JSON.stringify(value)); }catch(e){ /* private mode / quota exceeded — best effort */ }
  /* Also push to the shared server store (shared/session.js, loaded
     before this file on every page) so this same data shows up to
     every device/browser, not just this one -- see cpSyncPull/
     cpSyncPush there for the full explanation. Guarded by typeof since
     a handful of very old cached pages could theoretically still load
     this file without session.js; cpSaveJSON keeps working exactly as
     before (local-only) in that case. */
  if(typeof cpSyncPush === 'function') cpSyncPush(key, value);
}
