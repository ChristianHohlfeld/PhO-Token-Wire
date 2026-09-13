(() => {
  'use strict';
  const PTW = globalThis.PhenTokenWire;
  if (!PTW) return;

  let settings = null;
  let statusEl = null;
  let seq = 0;
  let timer = null;
  let lastPrepared = null;
  let lastTransport = null;

  const selectors = [
    '#prompt-textarea',
    'textarea[placeholder]',
    'textarea',
    'div.ProseMirror[contenteditable="true"]',
    'rich-textarea [contenteditable="true"]',
    '[contenteditable="true"][role="textbox"]',
    '[contenteditable="true"]'
  ];

  function runtimeMessage(message) {
    return new Promise(resolve => chrome.runtime.sendMessage(message, resolve));
  }

  async function getSettings() {
    settings = await runtimeMessage({ type: 'GET_SETTINGS' });
    return settings;
  }

  function visible(el) {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.width > 40 && r.height > 20 && r.bottom > 0 && r.top < innerHeight;
  }

  function findComposer() {
    const candidates = selectors.flatMap(sel => Array.from(document.querySelectorAll(sel)));
    return candidates.filter(visible).sort((a, b) => b.getBoundingClientRect().bottom - a.getBoundingClientRect().bottom)[0] || null;
  }

  function readComposer(el) {
    if (!el) return '';
    if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) return el.value;
    return el.innerText || el.textContent || '';
  }

  function encode64(text) {
    const bytes = new TextEncoder().encode(String(text || ''));
    let bin = '';
    const CHUNK = 8192;
    for (let i = 0; i < bytes.length; i += CHUNK) bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
    return btoa(bin);
  }

  function clearWireState() {
    const root = document.documentElement;
    if (!root) return;
    for (const attr of ['data-pholine-use','data-pholine-raw','data-pholine-channel','data-pholine-lang']) root.removeAttribute(attr);
  }

  function publishWireState(prepared, use) {
    const root = document.documentElement;
    if (!root) return;
    root.setAttribute('data-pholine-use', use ? '1' : '0');
    root.setAttribute('data-pholine-raw', encode64(prepared.raw));
    root.setAttribute('data-pholine-channel', encode64(prepared.channel));
    root.setAttribute('data-pholine-lang', prepared.lang);
  }

  async function count(text) {
    return runtimeMessage({ type: 'TOKEN_COUNT', text });
  }

  function delta(before, after) {
    const saved = before - after;
    const pct = before ? saved * 100 / before : 0;
    return `${saved >= 0 ? '-' : '+'}${Math.abs(saved)} (${saved >= 0 ? '-' : '+'}${Math.abs(pct).toFixed(1)}%)`;
  }

  async function prepareCurrentComposer() {
    if (!settings) await getSettings();
    if (!settings.enabled) {
      clearWireState();
      return updateStatus('deaktiviert');
    }

    const composer = findComposer();
    const raw = readComposer(composer).trim();
    if (!raw) {
      clearWireState();
      lastPrepared = null;
      return updateStatus('bereit · wartet auf Eingabe');
    }

    const mySeq = ++seq;
    updateStatus('PhO-Kanal wird gemessen …');

    const prepared = PTW.encode(raw, {
      language: settings.language || 'auto',
      replyChannel: settings.replyChannel !== false
    });

    const [rawM, ipaM, channelM] = await Promise.all([
      count(prepared.raw),
      count(prepared.ipa),
      count(prepared.channel)
    ]);
    if (mySeq !== seq) return;

    const exact = rawM.exact && ipaM.exact && channelM.exact;
    const use = exact && channelM.count < rawM.count;
    publishWireState(prepared, use);
    lastPrepared = { ...prepared, rawM, ipaM, channelM, use };

    const language = prepared.lang.toUpperCase();
    const transport = lastTransport ? ` · letzter Hook: ${lastTransport}` : '';
    if (!exact) {
      updateStatus(`${language} · tokenizer nicht exakt · pass-through${transport}`);
      return;
    }
    if (!use) {
      updateStatus(`${language} · roh ${rawM.count} · IPA-Probe ${ipaM.count} · Kanal ${channelM.count}\nkein Gewinn → Original bleibt${transport}`);
      return;
    }
    updateStatus(`${language} · roh ${rawM.count} · IPA-Probe ${ipaM.count} · Kanal ${channelM.count} ${delta(rawM.count, channelM.count)}\nHook armed · UI bleibt original${transport}`);
  }

  function schedulePrepare(delay = 60) {
    clearTimeout(timer);
    timer = setTimeout(() => prepareCurrentComposer().catch(err => {
      clearWireState();
      updateStatus(`Fehler: ${String(err?.message || err)}`);
    }), delay);
  }

  function updateStatus(text) {
    if (statusEl) statusEl.textContent = text;
  }

  function buildWidget() {
    if (document.getElementById('pho-token-wire-widget')) return;
    const root = document.createElement('div');
    root.id = 'pho-token-wire-widget';
    root.innerHTML = `
      <div class="ptw-head"><span>PhoLine</span><span class="ptw-badge">network hook</span></div>
      <div class="ptw-body">
        <div class="ptw-stats">bereit · wartet auf Eingabe</div>
        <div class="ptw-mini">Textfeld bleibt unverändert. Nur der ausgehende Request wird ersetzt, wenn der gemessene Kanal billiger ist.</div>
      </div>`;
    document.documentElement.appendChild(root);
    statusEl = root.querySelector('.ptw-stats');
  }

  function assistantBlocks() {
    const sels = [
      '[data-message-author-role="assistant"]',
      '[data-testid*="assistant"]',
      '.font-claude-message',
      'message-content',
      '.response-container',
      'main article'
    ];
    return Array.from(new Set(sels.flatMap(s => Array.from(document.querySelectorAll(s)))));
  }

  function maybeDecode(block) {
    if (!settings?.decodeReplies || block.dataset.pholineDecoded === '1') return;
    if (block.closest('#pho-token-wire-widget') || block.querySelector('pre, code')) return;
    const raw = (block.innerText || block.textContent || '').trim();
    if (!raw.startsWith('¶')) return;
    const lang = lastPrepared?.lang || 'en';
    const atoms = PTW.expandResponse(raw, lang);
    if (!atoms?.length) return;
    const panel = document.createElement('div');
    panel.className = 'pho-wire-decoded';
    panel.innerHTML = `<div class="pholine-label">PhoLine expanded</div><ul>${atoms.map(x => `<li>${escapeHtml(x)}</li>`).join('')}</ul>`;
    block.appendChild(panel);
    block.dataset.pholineDecoded = '1';
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>\"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;' }[c]));
  }

  function decodeExisting() {
    for (const block of assistantBlocks()) maybeDecode(block);
  }

  function onNetworkMessage(event) {
    if (event.source !== window || event.data?.source !== 'pholine-main') return;
    if (event.data.type !== 'request-rewritten') return;
    lastTransport = event.data.transport || 'network';
    if (lastPrepared) {
      updateStatus(`${lastPrepared.lang.toUpperCase()} · roh ${lastPrepared.rawM.count} · IPA-Probe ${lastPrepared.ipaM.count} · Kanal ${lastPrepared.channelM.count} ${delta(lastPrepared.rawM.count, lastPrepared.channelM.count)}\n✓ Request ersetzt via ${lastTransport}`);
    }
  }

  async function init() {
    await getSettings();
    buildWidget();
    schedulePrepare(0);
    decodeExisting();

    document.addEventListener('input', () => schedulePrepare(20), true);
    document.addEventListener('change', () => schedulePrepare(20), true);
    document.addEventListener('keydown', () => schedulePrepare(0), true);
    window.addEventListener('message', onNetworkMessage);

    const observer = new MutationObserver(() => {
      if (!document.getElementById('pho-token-wire-widget')) buildWidget();
      decodeExisting();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'sync') return;
      Object.assign(settings, Object.fromEntries(Object.entries(changes).map(([key, value]) => [key, value.newValue])));
      schedulePrepare(0);
    });
  }

  init().catch(err => console.error('[PhoLine]', err));
})();
