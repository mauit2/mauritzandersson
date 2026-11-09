/*
 * Shared behaviour for every page:
 *   1. Cookie consent + Google Analytics (loads only after "Accept").
 *   2. Bot-resistant email reveal (address never appears in the HTML).
 *
 * ── SET YOUR GOOGLE ANALYTICS ID HERE ─────────────────────────────
 * Replace the placeholder with your GA4 Measurement ID (e.g. G-AB12CD34EF).
 * While it is the placeholder, Analytics is off and no banner is shown.
 */
const GA_MEASUREMENT_ID = 'G-9B8PCD69CD';

(() => {
  'use strict';

  /* ---------- 1. Consent + Google Analytics ---------- */
  const CONSENT_KEY = 'ma-cookie-consent';
  const CONSENT_MAX_AGE = 1000 * 60 * 60 * 24 * 365; // ask again after 12 months
  const gaConfigured = /^G-[A-Z0-9]{4,}$/.test(GA_MEASUREMENT_ID) && GA_MEASUREMENT_ID !== 'G-XXXXXXXXXX';

  function readConsent() {
    try {
      const raw = localStorage.getItem(CONSENT_KEY);
      if (!raw) return null;
      const c = JSON.parse(raw);
      if (!c || !c.t || Date.now() - c.t > CONSENT_MAX_AGE) return null;
      return c.v === 'granted' || c.v === 'denied' ? c.v : null;
    } catch { return null; }
  }
  function writeConsent(v) {
    try { localStorage.setItem(CONSENT_KEY, JSON.stringify({ v, t: Date.now() })); } catch { /* storage blocked */ }
  }

  function loadAnalytics() {
    if (!gaConfigured || window.__maGaLoaded) return;
    window.__maGaLoaded = true;
    window['ga-disable-' + GA_MEASUREMENT_ID] = false;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', GA_MEASUREMENT_ID, {
      allow_google_signals: false,            // no cross-device / demographics
      allow_ad_personalization_signals: false // never used for advertising
    });
    const s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GA_MEASUREMENT_ID);
    document.head.appendChild(s);
  }

  function removeAnalyticsCookies() {
    window['ga-disable-' + GA_MEASUREMENT_ID] = true;
    const names = document.cookie.split(';').map(c => c.split('=')[0].trim()).filter(n => /^_ga/.test(n));
    const parts = location.hostname.split('.');
    names.forEach(n => {
      document.cookie = n + '=; Max-Age=0; path=/';
      for (let i = 0; i < parts.length - 1; i++) {
        document.cookie = n + '=; Max-Age=0; path=/; domain=.' + parts.slice(i).join('.');
      }
    });
  }

  let banner = null;
  function buildBanner() {
    banner = document.createElement('section');
    banner.className = 'consent';
    banner.setAttribute('role', 'region');
    banner.setAttribute('aria-label', 'Cookie consent');
    banner.innerHTML =
      '<p class="consent-text">' +
        (gaConfigured
          ? 'May I use Google Analytics to count visits to this site? It sets cookies and is only switched on if you accept. '
          : 'This site doesn’t use any optional cookies right now. ') +
        '<a href="cookies.html">Cookie policy</a> · <a href="privacy.html">Privacy policy</a>' +
      '</p>' +
      '<div class="consent-actions">' +
        (gaConfigured
          ? '<button type="button" class="btn consent-btn" data-choice="denied">Reject</button>' +
            '<button type="button" class="btn consent-btn" data-choice="granted">Accept</button>'
          : '<button type="button" class="btn consent-btn" data-choice="close">Close</button>') +
      '</div>';
    banner.addEventListener('click', e => {
      const b = e.target.closest('[data-choice]');
      if (!b) return;
      const choice = b.dataset.choice;
      if (choice === 'granted') { writeConsent('granted'); loadAnalytics(); }
      if (choice === 'denied') {
        const wasLoaded = window.__maGaLoaded;
        writeConsent('denied');
        removeAnalyticsCookies();
        if (wasLoaded) { location.reload(); return; } // fully unload the Google script
      }
      hideBanner();
    });
    document.body.appendChild(banner);
  }
  function showBanner() {
    if (!banner) buildBanner();
    banner.hidden = false;
    const first = banner.querySelector('button');
    if (first) first.focus({ preventScroll: true });
  }
  function hideBanner() { if (banner) banner.hidden = true; }

  const consent = readConsent();
  if (consent === 'granted') loadAnalytics();
  else if (consent === null && gaConfigured) showBanner();

  document.addEventListener('click', e => {
    if (e.target.closest('[data-consent-open]')) { e.preventDefault(); showBanner(); }
  });

  /* ---------- 2. Email reveal ----------
   * The address is stored XOR-encoded and reversed, so it never appears in the
   * page source for scrapers. It is decoded only after a real (trusted) click,
   * and not within the first moment after load, which filters automated clickers.
   */
  const ENC = [55, 53, 57, 116, 54, 51, 59, 55, 61, 26, 98, 106, 104, 106, 32, 46, 51, 40, 47, 59, 55];
  const KEY = 0x5A;
  const loadedAt = performance.now();
  let revealCount = 0;

  function decode() { return ENC.slice().reverse().map(c => String.fromCharCode(c ^ KEY)).join(''); }

  function revealAll() {
    const addr = decode();
    document.querySelectorAll('[data-email]').forEach(btn => {
      const a = document.createElement('a');
      a.href = 'mailto:' + addr;
      a.textContent = btn.dataset.emailLabel || addr;
      btn.replaceWith(a);
    });
  }

  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-email]');
    if (!btn) return;
    e.preventDefault();
    if (!e.isTrusted) return;                       // ignore scripted clicks
    if (performance.now() - loadedAt < 1200) return; // ignore instant clicks right after load
    if (++revealCount > 5) return;                   // per-page-view cap
    revealAll();
  });
})();
