// ==UserScript==
// @name         SV Graphics — BigShip Label Collector
// @namespace    sv-graphics
// @version      8.0
// @description  Collect labels manually, save as ZIP or open directly in Label Arranger
// @match        https://app.bigship.in/*
// @require      https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const LABEL_ARRANGER_URL = 'https://chahatagrawal117.github.io/sv-label-printer';

  // ─────────────────────────────────────────────────────────────────────────
  //  WORKFLOW
  //  1. Click "▶ Start Collecting"
  //  2. Click Action → Print Label for each order manually (as normal)
  //     Counter shows: 1 ✓  2 ✓  3 ✓ ...
  //  3. Click "⏹ Stop" when done
  //  4. Two buttons appear:
  //     [📦 Download ZIP]  saves Labels_2026-03-06_1430.zip
  //     [🖨 Open in Label Arranger]  opens GitHub page + auto-loads all labels
  // ─────────────────────────────────────────────────────────────────────────

  const collected  = [];   // { filename, bytes }
  let collecting   = false;
  let cachedZip    = null; // { blob, name } cached after first build

  // ── Intercept fetch — capture label PDF from API response ─────────────────
  const _fetch = window.fetch.bind(window);
  window.fetch = async function (input, init = {}) {
    const res = await _fetch(input, init);
    if (collecting) {
      try {
        const json = await res.clone().json().catch(() => null);
        if (json?.success && json?.data?.res_FileContent) {
          const filename = (json.data.res_FileName || `Label_${Date.now()}`) + '.pdf';
          collected.push({ filename, bytes: b64ToBytes(json.data.res_FileContent) });
          console.log('[SV] Collected via fetch:', filename);
          onCaptured();
        }
      } catch (_) {}
    }
    return res;
  };

  // ── Intercept XHR ─────────────────────────────────────────────────────────
  const _xhrOpen = XMLHttpRequest.prototype.open;
  const _xhrSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (m, url, ...r) {
    this._svUrl = url;
    return _xhrOpen.call(this, m, url, ...r);
  };
  XMLHttpRequest.prototype.send = function (...args) {
    if (collecting) {
      this.addEventListener('load', function () {
        try {
          const json = JSON.parse(this.responseText);
          if (json?.success && json?.data?.res_FileContent) {
            const filename = (json.data.res_FileName || `Label_${Date.now()}`) + '.pdf';
            collected.push({ filename, bytes: b64ToBytes(json.data.res_FileContent) });
            console.log('[SV] Collected via XHR:', filename);
            onCaptured();
          }
        } catch (_) {}
      });
    }
    return _xhrSend.apply(this, args);
  };

  // ── Intercept blob <a download> so PDF doesn't go to Downloads ────────────
  document.addEventListener('click', function (e) {
    if (!collecting) return;
    const a = e.target.closest('a[download]');
    if (!a) return;
    const href = a.href || '';
    if (href.startsWith('blob:')) {
      e.preventDefault();
      e.stopImmediatePropagation();
      fetch(href).then(r => r.arrayBuffer()).then(buf => {
        const filename = a.download || `Label_${Date.now()}.pdf`;
        collected.push({ filename, bytes: new Uint8Array(buf) });
        console.log('[SV] Collected blob:', filename);
        onCaptured();
      });
    }
  }, true);

  // ── Helpers ───────────────────────────────────────────────────────────────
  function b64ToBytes(b64) {
    const bin = atob(b64), out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  async function buildZip() {
    if (cachedZip) return cachedZip;
    const now  = new Date();
    const date = now.toISOString().slice(0, 10);
    const hh   = String(now.getHours()).padStart(2, '0');
    const mm   = String(now.getMinutes()).padStart(2, '0');
    const name = `Labels_${date}_${hh}${mm}`;
    const zip  = new JSZip();
    const folder = zip.folder(name);
    collected.forEach(({ filename, bytes }) => folder.file(filename, bytes));
    const blob = await zip.generateAsync({ type: 'blob' });
    cachedZip = { blob, name };
    return cachedZip;
  }

  function onCaptured() {
    cachedZip = null; // invalidate cache when new label added
    const counter = document.getElementById('sv-counter');
    if (!counter) return;
    const n = collected.length;
    counter.textContent = `${n} label${n !== 1 ? 's' : ''} ✓`;
    counter.style.color = '#4ade80';
    counter.style.borderColor = 'rgba(74,222,128,0.4)';
    counter.style.background = 'rgba(74,222,128,0.08)';
    setTimeout(() => { counter.style.background = 'transparent'; }, 500);
  }

  function showToast(msg, type = 'info') {
    let el = document.getElementById('sv-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'sv-toast';
      el.style.cssText = `
        position:fixed;bottom:90px;right:24px;z-index:999998;
        padding:11px 16px;border-radius:10px;font-size:12px;font-weight:600;
        font-family:sans-serif;box-shadow:0 8px 24px rgba(0,0,0,0.5);
        max-width:300px;line-height:1.5;border-left:3px solid;
        white-space:pre-line;transition:opacity 0.4s;pointer-events:none;
      `;
      document.body.appendChild(el);
    }
    const c = { success:['#0f1a12','#4ade80'], error:['#1a0f0f','#f87171'], info:['#0f0f1a','#4f8ef7'] };
    const [bg, ac] = c[type] || c.info;
    el.style.background = bg;
    el.style.borderLeftColor = ac;
    el.style.color = ac;
    el.textContent = msg;
    el.style.opacity = '1';
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.style.opacity = '0'; }, 4000);
  }

  // ── Build panel ───────────────────────────────────────────────────────────
  function buildUI() {
    if (document.getElementById('sv-collector')) return;

    const panel = document.createElement('div');
    panel.id = 'sv-collector';
    panel.style.cssText = `
      position:fixed;bottom:20px;left:50%;transform:translateX(-50%);
      z-index:999999;display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:center;
      background:#111318;border:1.5px solid #1e2330;border-radius:14px;
      padding:10px 16px;box-shadow:0 12px 40px rgba(0,0,0,0.7);
      font-family:sans-serif;max-width:90vw;
    `;

    function mkBtn(html, bg, color, extra = '') {
      const b = document.createElement('button');
      b.innerHTML = html;
      b.style.cssText = `background:${bg};color:${color};border:none;border-radius:8px;
        padding:9px 16px;font-size:13px;font-weight:800;cursor:pointer;
        white-space:nowrap;transition:all 0.15s;font-family:sans-serif;${extra}`;
      return b;
    }

    const startBtn    = mkBtn('▶ Start Collecting', '#4ade80', '#0a0c0f');
    const counter     = document.createElement('span');
    counter.id        = 'sv-counter';
    const zipBtn      = mkBtn('📦 Download ZIP', '#22d3ee', '#0a0c0f', 'display:none');
    const arrangerBtn = mkBtn('🖨 Open in Label Arranger', '#a78bfa', '#0a0c0f', 'display:none');
    const clearBtn    = mkBtn('✕ Clear', 'transparent', '#4a5068',
                              'border:1px solid #1e2330;display:none;');

    counter.style.cssText = `font-size:12px;font-weight:700;color:#4a5068;
      border:1px solid #1e2330;border-radius:20px;padding:5px 12px;
      white-space:nowrap;font-family:monospace;display:none;`;
    counter.textContent = '0 labels';

    panel.appendChild(startBtn);
    panel.appendChild(counter);
    panel.appendChild(zipBtn);
    panel.appendChild(arrangerBtn);
    panel.appendChild(clearBtn);
    document.body.appendChild(panel);

    // ── State helpers ─────────────────────────────────────────────────────
    function setIdle() {
      collecting = false;
      startBtn.innerHTML = '▶ Start Collecting';
      startBtn.style.background = '#4ade80';
      counter.style.display = 'none';
      zipBtn.style.display = 'none';
      arrangerBtn.style.display = 'none';
      clearBtn.style.display = 'none';
    }

    function setActive() {
      collecting = true;
      cachedZip  = null;
      startBtn.innerHTML = '⏹ Stop';
      startBtn.style.background = '#f87171';
      counter.style.display = 'inline-block';
      counter.textContent = `${collected.length} label${collected.length !== 1 ? 's' : ''} ✓`;
      zipBtn.style.display = 'none';
      arrangerBtn.style.display = 'none';
      clearBtn.style.display = 'none';
      showToast('▶ Collecting started!\nClick Action → Print Label for each order.', 'info');
    }

    function setStopped() {
      collecting = false;
      startBtn.innerHTML = '▶ Start Again';
      startBtn.style.background = '#4ade80';
      clearBtn.style.display = 'inline-block';
      if (collected.length > 0) {
        zipBtn.style.display = 'inline-block';
        arrangerBtn.style.display = 'inline-block';
        showToast(`⏹ Done! ${collected.length} label${collected.length > 1 ? 's' : ''} ready.\nDownload ZIP or open in Label Arranger.`, 'success');
      } else {
        showToast('⏹ Stopped — no labels captured yet.', 'info');
      }
    }

    // ── Start / Stop ──────────────────────────────────────────────────────
    startBtn.addEventListener('click', () => {
      if (!collecting && collected.length === 0) setActive();
      else if (collecting) setStopped();
      else setActive(); // Start Again
    });

    // ── Download ZIP ──────────────────────────────────────────────────────
    zipBtn.addEventListener('click', async () => {
      if (!collected.length) return;
      zipBtn.innerHTML = '⏳ Zipping…';
      zipBtn.disabled = true;

      const { blob, name } = await buildZip();
      const url = URL.createObjectURL(blob);
      const a   = document.createElement('a');
      a.href = url; a.download = `${name}.zip`;
      a.style.display = 'none';
      document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 2000);

      zipBtn.innerHTML = '📦 Download ZIP';
      zipBtn.disabled  = false;
      showToast(`✓ ${name}.zip downloaded!`, 'success');
    });

    // ── Open in Label Arranger ────────────────────────────────────────────
    arrangerBtn.addEventListener('click', async () => {
      if (!collected.length) { showToast('No labels collected yet.', 'error'); return; }
      arrangerBtn.innerHTML = '⏳ Preparing…';
      arrangerBtn.disabled  = true;

      try {
        cachedZip = null;
        const { blob, name } = await buildZip();
        const zipName = name + '.zip';

        // Step 1: Open the Label Arranger tab first
        const newTab = window.open(`${LABEL_ARRANGER_URL}?autoload=1`, '_blank');

        // Step 2: Convert ZIP to base64 and write to localStorage
        // The new tab polls localStorage until it finds this entry
        const reader = new FileReader();
        reader.onload = function () {
          const b64 = reader.result.split(',')[1];
          localStorage.setItem('sv_pending_zip', JSON.stringify({
            name: zipName,
            data: b64,
            ts:   Date.now(),
          }));
          showToast(`✓ Opening Label Arranger with ${collected.length} labels…`, 'success');
        };
        reader.readAsDataURL(new Blob([blob], { type: 'application/zip' }));

      } catch (e) {
        showToast('Error: ' + e.message, 'error');
      }

      arrangerBtn.innerHTML = '🖨 Open in Label Arranger';
      arrangerBtn.disabled  = false;
    });

    // ── Clear ─────────────────────────────────────────────────────────────
    clearBtn.addEventListener('click', () => {
      collected.length = 0;
      cachedZip        = null;
      localStorage.removeItem('sv_pending_zip');
      setIdle();
      showToast('Cleared — ready to start again.', 'info');
    });
  }

  // ── Watch for SPA navigation ──────────────────────────────────────────────
  let lastUrl = location.href;
  const isReportsPage = () => /reports|shipment|orders/i.test(location.href);

  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      document.getElementById('sv-collector')?.remove();
      if (isReportsPage()) setTimeout(buildUI, 1500);
    }
  }).observe(document.body, { childList: true, subtree: true });

  setTimeout(() => { if (isReportsPage()) buildUI(); }, 2000);

})();
