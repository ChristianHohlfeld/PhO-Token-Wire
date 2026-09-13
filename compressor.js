(() => {
  'use strict';

  const PROTECTED_RE = /```[\s\S]*?```|`[^`\n]+`|https?:\/\/[^\s<>()]+|\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b|\b(?:[A-Fa-f0-9]{8,}|\d{6,})\b/g;

  const SAFE_REPLACEMENTS = [
    [/\baufgrund der Tatsache, dass\b/gi, 'weil'],
    [/\bauf Grund der Tatsache, dass\b/gi, 'weil'],
    [/\bin Bezug auf\b/gi, 'zu'],
    [/\bim Hinblick auf\b/gi, 'zu'],
    [/\bzum Beispiel\b/gi, 'z.B.'],
    [/\bdas heißt\b/gi, 'd.h.'],
    [/\bbeziehungsweise\b/gi, 'bzw.'],
    [/\bunter anderem\b/gi, 'u.a.'],
    [/\bmit anderen Worten\b/gi, 'anders:'],
    [/\bin der Lage sein(?:,)?\s+zu\b/gi, 'können'],
    [/\bat this point in time\b/gi, 'now'],
    [/\bdue to the fact that\b/gi, 'because'],
    [/\bin order to\b/gi, 'to'],
    [/\bwith regard to\b/gi, 'about'],
    [/\bfor example\b/gi, 'e.g.'],
    [/\bthat is to say\b/gi, 'i.e.']
  ];

  const LEADING_FILLER = [
    /^\s*(?:kannst du|könntest du|würdest du)\s+(?:mir\s+)?(?:bitte\s+)?/i,
    /^\s*bitte\s+/i,
    /^\s*ich möchte,?\s+dass du\s+/i,
    /^\s*ich hätte gerne,?\s+dass du\s+/i,
    /^\s*(?:could you|can you|would you)\s+(?:please\s+)?/i,
    /^\s*please\s+/i,
    /^\s*i(?:'d| would) like you to\s+/i
  ];

  // Aggressive mode removes grammatical surface redundancy while keeping
  // negation, numbers, code, URLs and named/quoted payload untouched.
  const TELEGRAPH_REPLACEMENTS = [
    [/\b(?:also|sozusagen|im Grunde genommen|eigentlich|quasi)\b[,:]?\s*/gi, ''],
    [/\b(?:ich denke,? dass|ich glaube,? dass)\b\s*/gi, ''],
    [/\b(?:es ist wichtig zu beachten,? dass|man muss beachten,? dass)\b\s*/gi, ''],
    [/\b(?:basically|actually|in fact)\b[,:]?\s*/gi, ''],
    [/\b(?:I think that|I believe that)\b\s*/gi, ''],
    [/\b(?:it is important to note that|note that)\b\s*/gi, ''],
    [/\b(?:der|die|das|den|dem|des|ein|eine|einen|einem|einer|eines)\b\s*/gi, ''],
    [/\b(?:the|a|an)\b\s*/gi, '']
  ];

  function protect(text) {
    const slots = [];
    const body = text.replace(PROTECTED_RE, (m) => {
      const id = `\uE000${slots.length}\uE001`;
      slots.push(m);
      return id;
    });
    return { body, slots };
  }

  function restore(text, slots) {
    return text.replace(/\uE000(\d+)\uE001/g, (_, i) => slots[Number(i)] ?? _);
  }

  function normalize(text) {
    return text
      .replace(/[ \t]+/g, ' ')
      .replace(/ *\n */g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/\s+([!?.,;:])/g, '$1')
      .replace(/([!?.,;:])\1{1,}/g, '$1')
      .trim();
  }

  function safeCompress(input) {
    if (!input || !input.trim()) return input;
    const { body, slots } = protect(input);
    let out = body;
    for (const [re, replacement] of SAFE_REPLACEMENTS) out = out.replace(re, replacement);
    out = out.split('\n').map((line) => {
      let s = line;
      for (const re of LEADING_FILLER) s = s.replace(re, '');
      return s;
    }).join('\n');
    out = out.replace(/\b([\p{L}\p{N}_-]{2,})\s+\1\b/giu, '$1');
    return restore(normalize(out), slots);
  }

  function aggressiveCompress(input) {
    if (!input || !input.trim()) return input;
    const safe = safeCompress(input);
    const { body, slots } = protect(safe);
    let out = body;
    for (const [re, replacement] of TELEGRAPH_REPLACEMENTS) out = out.replace(re, replacement);
    // Keep logical operators/negation; squeeze prose into a model-readable telegram.
    out = out
      .replace(/\s+(?:und|and)\s+/gi, '; ')
      .replace(/\s+(?:aber|but)\s+/gi, '; aber ')
      .replace(/\s*;\s*;+/g, '; ');
    return restore(normalize(out), slots);
  }

  function compressInput(input, level = 'safe') {
    return level === 'aggressive' ? aggressiveCompress(input) : safeCompress(input);
  }

  function inputCandidates(input, level = 'safe') {
    const seen = new Set();
    const out = [];
    const add = (name, text) => {
      const v = (text || '').trim();
      if (!v || seen.has(v)) return;
      seen.add(v);
      out.push({ name, text: v });
    };
    add('original', input);
    add('safe', safeCompress(input));
    if (level === 'aggressive') add('aggressive', aggressiveCompress(input));
    return out;
  }

  function responseHint(lang = 'de', maxWords = 80) {
    // Deliberately tiny: the old TW1 schema cost ~100 input tokens per turn.
    return lang === 'en'
      ? `Reply tersely; useful content only; ≤${maxWords} words.`
      : `Knapp antworten; nur Nutzinhalt; ≤${maxWords} Wörter.`;
  }

  // Compatibility alias for older installs/settings.
  function wireInstruction(lang = 'de', maxWords = 80) {
    return responseHint(lang, maxWords);
  }

  function detectLanguage(text) {
    const de = (text.match(/\b(?:der|die|das|und|ist|nicht|mit|für|ich|du|bitte|warum|wie|was)\b/gi) || []).length;
    const en = (text.match(/\b(?:the|and|is|not|with|for|I|you|please|why|how|what)\b/gi) || []).length;
    return de >= en ? 'de' : 'en';
  }

  // Legacy decoder retained so old TW1 replies remain readable.
  function parseWire(raw) {
    if (!raw || !/(?:^|\n|;\s*)\s*[KFUN]:/m.test(raw)) return null;
    const result = { K: [], F: [], U: [], N: [] };
    const re = /(?:^|\n|;\s*)\s*([KFUN])\s*:\s*([\s\S]*?)(?=(?:\n|;\s*)\s*[KFUN]\s*:|$)/g;
    let m;
    while ((m = re.exec(raw))) {
      const key = m[1];
      const value = m[2].trim().replace(/;\s*$/, '');
      if (!value) continue;
      const items = key === 'F' ? value.split(/\s*\|\s*/).filter(Boolean) : [value];
      result[key].push(...items);
    }
    return Object.values(result).some((v) => v.length) ? result : null;
  }

  function escapeHtml(s) {
    return s.replace(/[&<>\"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;' }[c]));
  }

  function renderWire(parsed, lang = 'de') {
    if (!parsed) return '';
    const labels = lang === 'en'
      ? { K: 'Core', F: 'Facts', U: 'Uncertainty', N: 'Next' }
      : { K: 'Kern', F: 'Fakten', U: 'Unsicherheit', N: 'Nächster Schritt' };
    const sections = [];
    if (parsed.K.length) sections.push(`<div><b>${labels.K}:</b> ${escapeHtml(parsed.K.join(' '))}</div>`);
    if (parsed.F.length) sections.push(`<div><b>${labels.F}:</b><ul>${parsed.F.map(x => `<li>${escapeHtml(x)}</li>`).join('')}</ul></div>`);
    if (parsed.U.length) sections.push(`<div><b>${labels.U}:</b> ${escapeHtml(parsed.U.join(' '))}</div>`);
    if (parsed.N.length) sections.push(`<div><b>${labels.N}:</b> ${escapeHtml(parsed.N.join(' '))}</div>`);
    return sections.join('');
  }

  function composeForSend(input, settings = {}) {
    const level = settings.level || 'safe';
    const compact = settings.compressInput === false ? input : compressInput(input, level);
    if (settings.wireMode === false) return compact;
    const lang = detectLanguage(input);
    return `${compact}\n\n${responseHint(lang, settings.maxWords || 80)}`;
  }

  const api = {
    compressInput,
    inputCandidates,
    responseHint,
    wireInstruction,
    detectLanguage,
    parseWire,
    renderWire,
    composeForSend
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  globalThis.PhenTokenWire = api;
})();
