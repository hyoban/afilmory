const GLOBAL_CSS = `
*, *::before, *::after { box-sizing: border-box; }
html, body {
  margin: 0;
  padding: 0;
  background: transparent;
  color: rgba(255, 255, 255, 0.92);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", sans-serif;
  font-feature-settings: "ss01", "cv11";
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
body {
  display: block;
  overflow: hidden;
}
a { color: inherit; text-decoration: none; }
img { display: block; max-width: 100%; }
button { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; }

.af-card {
  background: #0a0a0a;
  overflow: hidden;
  color: rgba(255, 255, 255, 0.92);
  width: 100%;
}

.af-photo {
  position: relative;
  background: #050505;
  overflow: hidden;
}
.af-photo img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
}
.af-photo .af-thumbhash {
  position: absolute;
  inset: 0;
  filter: blur(6px);
  transform: scale(1.04);
}

.af-badge {
  position: absolute;
  bottom: 12px;
  right: 12px;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 6px 10px;
  background: rgba(20, 20, 20, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  color: rgba(255, 255, 255, 0.92);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.01em;
  text-decoration: none;
}
.af-badge-inline { position: static; }
.af-badge-dot { width: 5px; height: 5px; background: #4ade80; }
.af-badge-via { font-size: 9px; opacity: 0.5; margin-left: 4px; font-weight: 400; }

.af-meta {
  padding: 14px 16px 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}
.af-meta-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}
.af-title {
  font-size: 15px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.95);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}
.af-view-link {
  font-size: 11px;
  color: #5eb3ff;
  flex-shrink: 0;
  font-weight: 500;
  letter-spacing: 0.02em;
}
.af-sub {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.55);
  margin-bottom: 10px;
  font-variant-numeric: tabular-nums;
}
.af-sub .af-sep { color: rgba(255, 255, 255, 0.2); }

.af-exif {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 6px;
}
.af-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.04);
  color: rgba(255, 255, 255, 0.85);
  padding: 3px 8px;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.01em;
}
.af-chip svg { width: 10px; height: 10px; opacity: 0.55; }

.af-coll-header {
  padding: 12px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}
.af-coll-title {
  font-size: 13px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.92);
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.af-count {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.45);
  font-variant-numeric: tabular-nums;
  font-weight: 400;
}
.af-tag-pill {
  font-size: 11px;
  padding: 2px 8px;
  background: rgba(94, 179, 255, 0.12);
  border: 1px solid rgba(94, 179, 255, 0.2);
  border-radius: 4px;
  color: #5eb3ff;
  font-weight: 500;
  letter-spacing: 0.01em;
  white-space: nowrap;
}

.af-grid { display: grid; gap: 1px; background: rgba(255, 255, 255, 0.04); }
.af-grid-cell {
  position: relative;
  aspect-ratio: 1;
  background: #050505;
  overflow: hidden;
}
.af-grid-cell img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.4s ease;
}
.af-grid-cell:hover img { transform: scale(1.04); }
.af-overflow {
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.03);
  color: rgba(255, 255, 255, 0.55);
  font-size: 14px;
  font-weight: 500;
  letter-spacing: 0.02em;
}
.af-overflow:hover { background: rgba(255, 255, 255, 0.06); color: rgba(255, 255, 255, 0.85); }

.af-strip {
  display: flex;
  gap: 4px;
  padding: 8px;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  background: rgba(0, 0, 0, 0.4);
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.15) transparent;
}
.af-strip::-webkit-scrollbar { height: 6px; }
.af-strip::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.15); }
.af-strip > * {
  flex: 0 0 38%;
  scroll-snap-align: start;
  aspect-ratio: 3 / 4;
  position: relative;
  background: #050505;
  overflow: hidden;
}
.af-strip img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.af-footer {
  padding: 10px 16px;
  text-align: right;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.af-empty {
  padding: 48px 16px;
  text-align: center;
  color: rgba(255, 255, 255, 0.4);
  font-size: 13px;
}
`

const RESIZE_SCRIPT = `(function(){
  var lastHeight = 0;
  function measure(){
    var card = document.querySelector('[data-afilmory-root]');
    if (card) {
      var rect = card.getBoundingClientRect();
      return Math.ceil(rect.height);
    }
    return Math.ceil(document.documentElement.getBoundingClientRect().height);
  }
  function postSize(){
    try {
      var h = measure();
      if (!h || h === lastHeight) return;
      lastHeight = h;
      parent.postMessage({ type: 'afilmory:resize', height: h }, '*');
    } catch (e) {}
  }
  function attach(){
    postSize();
    document.querySelectorAll('img').forEach(function(img){
      if (img.complete) return;
      img.addEventListener('load', postSize);
      img.addEventListener('error', postSize);
    });
    if (typeof ResizeObserver !== 'undefined') {
      try {
        var root = document.querySelector('[data-afilmory-root]') || document.documentElement;
        new ResizeObserver(postSize).observe(root);
      } catch (e) {}
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attach);
  } else {
    attach();
  }
  window.addEventListener('load', postSize);
  window.addEventListener('resize', postSize);
  // Retry a few times to survive parent script late-bind / iframe cached load races.
  var retries = 0;
  var retryId = setInterval(function(){
    postSize();
    if (++retries >= 6) clearInterval(retryId);
  }, 250);
})();`

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* eslint-disable-next-line react-dom/no-dangerously-set-innerhtml */}
      <style dangerouslySetInnerHTML={{ __html: GLOBAL_CSS }} />
      {children}
      {/* eslint-disable-next-line react-dom/no-dangerously-set-innerhtml */}
      <script dangerouslySetInnerHTML={{ __html: RESIZE_SCRIPT }} />
    </>
  )
}
