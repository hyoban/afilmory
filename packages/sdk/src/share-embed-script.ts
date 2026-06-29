export const SHARE_EMBED_SCRIPT = `(function(){
  'use strict';
  function buildIframeUrl(scriptEl){
    var u = new URL(scriptEl.src);
    var base = u.origin + '/share/iframe';
    var url = new URL(base);
    var ds = scriptEl.dataset;
    if (ds.afilmoryPhoto) {
      url.searchParams.set('id', ds.afilmoryPhoto);
    } else if (ds.afilmoryPhotos) {
      url.searchParams.set('ids', ds.afilmoryPhotos);
    } else if (ds.afilmoryTag) {
      url.searchParams.set('tag', ds.afilmoryTag);
      if (ds.limit) url.searchParams.set('limit', ds.limit);
    } else {
      return null;
    }
    if (ds.layout) url.searchParams.set('layout', ds.layout);
    return url.toString();
  }
  function initialAspect(scriptEl){
    var raw = scriptEl.dataset.aspect;
    if (raw) {
      var parts = raw.split(/[:\\/ ]+/).map(Number);
      if (parts.length === 2 && parts[0] > 0 && parts[1] > 0) {
        return parts[0] + ' / ' + parts[1];
      }
    }
    if (scriptEl.dataset.afilmoryPhoto) return '3 / 2';
    return '1 / 1';
  }
  function createIframe(scriptEl){
    var src = buildIframeUrl(scriptEl);
    if (!src) return null;
    var iframe = document.createElement('iframe');
    iframe.src = src;
    iframe.style.width = scriptEl.dataset.width || '100%';
    iframe.style.maxWidth = '100%';
    iframe.style.border = '0';
    iframe.style.display = 'block';
    iframe.style.aspectRatio = initialAspect(scriptEl);
    iframe.setAttribute('loading', 'lazy');
    iframe.setAttribute('referrerpolicy', 'no-referrer-when-downgrade');
    iframe.setAttribute('sandbox', 'allow-scripts allow-popups allow-popups-to-escape-sandbox');
    iframe.setAttribute('title', 'AFilmory embed');
    return iframe;
  }
  function mountAll(){
    var scripts = document.querySelectorAll('script[src*="/share/embed.js"]');
    for (var i = 0; i < scripts.length; i++) {
      var s = scripts[i];
      if (s.getAttribute('data-afilmory-mounted') === '1') continue;
      var iframe = createIframe(s);
      if (!iframe) continue;
      s.setAttribute('data-afilmory-mounted', '1');
      s.parentNode.insertBefore(iframe, s);
    }
  }
  window.addEventListener('message', function(e){
    if (!e.data || e.data.type !== 'afilmory:resize') return;
    var height = e.data.height;
    if (typeof height !== 'number' || !isFinite(height) || height <= 0) return;
    var iframes = document.querySelectorAll('iframe[data-afilmory-mounted]');
    for (var i = 0; i < iframes.length; i++) {
      if (iframes[i].contentWindow === e.source) {
        iframes[i].style.height = height + 'px';
        iframes[i].style.aspectRatio = '';
        return;
      }
    }
    var all = document.querySelectorAll('iframe[src*="/share/iframe"]');
    for (var j = 0; j < all.length; j++) {
      if (all[j].contentWindow === e.source) {
        all[j].setAttribute('data-afilmory-mounted', '1');
        all[j].style.height = height + 'px';
        all[j].style.aspectRatio = '';
        return;
      }
    }
  });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountAll);
  } else {
    mountAll();
  }
})();
`
