(() => {
  'use strict';
  const PTW = globalThis.PhenTokenWire;
  if (!PTW) return;

  let settings = null;
  let lastPrepared = null;
  let statusEl = null;
  let buttonEl = null;

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
    return new Promise((resolve) => chrome.runtime.sendMessage(message, resolve));
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
    return candidates.filter(visible).sort((a,b) => b.getBoundingClientRect().bottom - a.getBoundingClientRect().bottom)[0] || null;
  }

  function readComposer(el) {
    if (!el) return '';
    if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) return el.value;
    return el.innerText || el.textContent || '';
  }

  function setNativeValue(el, value) {
    if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
      const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
      setter ? setter.call(el, value) : (el.value = value);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }

    el.focus();
    try {
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(el);
      sel.removeAllRanges();
      sel.addRange(range);
      if (!document.execCommand('insertText', false, value)) throw new Error('insertText returned false');
    } catch {
      el.textContent = value;
      el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }));
    }
  }

  async function count(text) {
    return runtimeMessage({ type: 'TOKEN_COUNT', text });
  }

  function formatDelta(before, after) {
    const saved = before - after;
    const pct = before ? (100 * saved / before) : 0;
    return `${saved >= 0 ? '-' : '+'}${Math.abs(saved)} (${saved >= 0 ? '-' : '+'}${Math.abs(pct).toFixed(1)}%)`;
  }

  async function measuredCandidates(original) {
    if (settings.compressInput === false) {
      const m = await count(original);
      return [{ name: 'original', text: original, measure: m }];
    }
    const candidates = PTW.inputCandidates(original, settings.level || 'safe');
    const measures = await Promise.all(candidates.map(c => count(c.text)));
    return candidates.map((c, i) => ({ ...c, measure: measures[i] }));
  }

  async function prepareComposer() {
    if (!settings) await getSettings();
    if (!settings.enabled) return updateStatus('deaktiviert');
    const el = findComposer();
    if (!el) return updateStatus('kein Eingabefeld gefunden');
    const original = readComposer(el).trim();
    if (!original) return updateStatus('Eingabe ist leer');

    buttonEl.disabled = true;
    updateStatus('messe Kandidaten …');

    const candidates = await measuredCandidates(original);
    const originalCandidate = candidates.find(c => c.name === 'original') || candidates[0];
    const best = candidates.reduce((a, b) => b.measure.count < a.measure.count ? b : a);

    let outgoing = best.text;
    let hintTokens = 0;
    let outgoingMeasure = best.measure;

    if (settings.wireMode !== false) {
      const hint = PTW.responseHint(PTW.detectLanguage(original), settings.maxWords || 80);
      const withHint = `${best.text}\n\n${hint}`;
      outgoingMeasure = await count(withHint);
      hintTokens = outgoingMeasure.count - best.measure.count;
      outgoing = withHint;
    }

    const inputSaved = originalCandidate.measure.count - best.measure.count;
    const sendDelta = originalCandidate.measure.count - outgoingMeasure.count;

    if (settings.onlyIfInputSaves && sendDelta <= 0) {
      buttonEl.disabled = false;
      return updateStatus(
        `nicht geändert\nBestes Input: ${originalCandidate.measure.count} → ${best.measure.count} (${inputSaved} gespart)\n` +
        `Antwort-Hinweis würde ${Math.abs(sendDelta)} Token netto hinzufügen`
      );
    }

    // Never replace the user's text with a worse compression candidate.
    // The only allowed positive overhead is the explicit tiny response hint,
    // whose break-even is shown separately.
    setNativeValue(el, outgoing);
    lastPrepared = { original, outgoing, originalCandidate, best, outgoingMeasure, hintTokens };

    const exact = originalCandidate.measure.exact && best.measure.exact && outgoingMeasure.exact;
    const breakEven = Math.max(0, outgoingMeasure.count - originalCandidate.measure.count);
    const inputLine = `Input: ${originalCandidate.measure.count} → ${best.measure.count} ${formatDelta(originalCandidate.measure.count, best.measure.count)} [${best.name}]`;
    const sendLine = settings.wireMode !== false
      ? `Antwort-Hinweis: +${hintTokens}; gesendet: ${outgoingMeasure.count}; Break-even: ${breakEven} Completion-Token`
      : `gesendet: ${outgoingMeasure.count}`;

    updateStatus(`${inputLine}\n${sendLine}\n${exact ? 'o200k exakt' : 'Fallback-Schätzung'}`);
    buttonEl.disabled = false;
  }

  function updateStatus(text) {
    if (statusEl) statusEl.textContent = text;
  }

  function buildWidget() {
    if (document.getElementById('pho-token-wire-widget')) return;
    const root = document.createElement('div');
    root.id = 'pho-token-wire-widget';
    root.innerHTML = `
      <div class="ptw-head"><span>PhO Token Wire</span><span class="ptw-badge">measured</span></div>
      <div class="ptw-body">
        <button type="button">Token optimieren</button>
        <div class="ptw-stats">bereit</div>
        <div class="ptw-mini">Ändert nur den Composer. Senden bleibt manuell.</div>
      </div>`;
    document.documentElement.appendChild(root);
    buttonEl = root.querySelector('button');
    statusEl = root.querySelector('.ptw-stats');
    buttonEl.addEventListener('click', prepareComposer);
  }

  // Legacy TW1 decoder: harmless for new plain-text terse replies.
  function candidateAssistantBlocks() {
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

  function maybeDecodeBlock(block) {
    if (!settings?.autoDecode || block.dataset.phoWireDecoded === '1') return;
    if (block.closest('#pho-token-wire-widget')) return;
    const text = (block.innerText || block.textContent || '').trim();
    if (!text.includes('K:') && !text.includes('F:') && !text.includes('N:') && !text.includes('U:')) return;
    const parsed = PTW.parseWire(text);
    if (!parsed) return;
    const panel = document.createElement('div');
    panel.className = 'pho-wire-decoded';
    panel.innerHTML = PTW.renderWire(parsed, PTW.detectLanguage(text));
    block.appendChild(panel);
    block.dataset.phoWireDecoded = '1';
  }

  function decodeExisting() {
    for (const block of candidateAssistantBlocks()) maybeDecodeBlock(block);
  }

  async function init() {
    await getSettings();
    buildWidget();
    decodeExisting();

    const observer = new MutationObserver(() => {
      if (!document.getElementById('pho-token-wire-widget')) buildWidget();
      decodeExisting();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'sync') return;
      Object.assign(settings, Object.fromEntries(Object.entries(changes).map(([k,v]) => [k, v.newValue])));
      decodeExisting();
    });
  }

  init().catch(e => console.error('[PhO Token Wire]', e));
})();
