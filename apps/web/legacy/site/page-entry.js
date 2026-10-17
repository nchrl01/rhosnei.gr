// Runs inline after each page's <base>, before its content is painted.
(() => {
  const appRoot = new URL('./', document.baseURI);
  const markerKey = 'av-internal-arrival';
  const isInternal = url => url.origin === appRoot.origin && (
    url.pathname === appRoot.pathname.replace(/\/$/, '') ||
    url.pathname.startsWith(appRoot.pathname)
  );
  const destination = url => {
    const normalized = new URL(url);
    normalized.hash = '';
    return normalized.href;
  };
  let internalClick = false;
  try {
    const marker = JSON.parse(sessionStorage.getItem(markerKey) || 'null');
    sessionStorage.removeItem(markerKey);
    const age = marker ? Date.now() - marker.time : -1;
    internalClick = age >= 0 && age < 60000 && marker.to === destination(location.href);
  } catch { /* Referrer detection still works when storage is unavailable. */ }

  let internalReferrer = false;
  try {
    internalReferrer = Boolean(document.referrer) && isInternal(new URL(document.referrer));
  } catch { /* Missing or invalid referrers count as direct arrivals. */ }
  const navigation = performance.getEntriesByType?.('navigation')[0]?.type;
  const shouldReveal = navigation !== 'back_forward' && (
    navigation === 'reload' || (!internalClick && !internalReferrer)
  );
  if (shouldReveal) document.documentElement.dataset.pageEntry = 'arrival';

  document.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey ||
        event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest?.('a[href]');
    if (!link || link.hasAttribute('download') ||
        (link.target && link.target.toLowerCase() !== '_self')) return;
    const target = new URL(link.href, document.baseURI);
    if (!isInternal(target) || destination(target) === destination(location.href)) return;
    try {
      sessionStorage.setItem(markerKey, JSON.stringify({ to: destination(target), time: Date.now() }));
    } catch { /* The same-app referrer remains the fallback. */ }
  });
  window.addEventListener('pageshow', event => {
    if (event.persisted) delete document.documentElement.dataset.pageEntry;
  });
})();
