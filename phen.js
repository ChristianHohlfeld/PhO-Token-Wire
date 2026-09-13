(() => {
  'use strict';

  const PROTECTED_RE = /```[\s\S]*?```|`[^`\n]+`|https?:\/\/[^\s<>()]+|\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b|\b(?:[A-Fa-f0-9]{8,}|\d{4,})\b|"[^"\n]{1,160}"|'[^'\n]{1,160}'/g;

  const FUNCTION_WORDS_DE = new Set([
    'der','die','das','den','dem','des','ein','eine','einen','einem','einer','eines',
    'ist','sind','war','waren','wird','werden','wurde','wurden','sein','gewesen',
    'ich','du','er','sie','es','wir','ihr','man',
    'auch','doch','halt','eben','eigentlich','quasi','also','sozusagen',
    'bitte','gerne','mal'
  ]);

  const KEEP_ALWAYS_DE = new Set([
    'nicht','kein','keine','keinen','keinem','keiner','nie','ohne','nur','oder','aber','wenn','falls','weil','dass','als','mehr','weniger'
  ]);

  function protect(text) {
    const slots = [];
    const body = String(text || '').replace(PROTECTED_RE, (m) => {
      const id = `QX${slots.length}Q`;
      slots.push(m);
      return id;
    });
    return { body, slots };
  }

  function restore(text, slots) {
    return text.replace(/QX(\d+)Q/g, (_, i) => slots[Number(i)] ?? _);
  }

  function normalizeSpace(text) {
    return text
      .replace(/[ \t]+/g, ' ')
      .replace(/ *\n */g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/\s+([,.;:!?])/g, '$1')
      .trim();
  }

  function deWordToPhenA(word) {
    if (!word || /^QX\d+Q$/.test(word)) return word;
    let w = word.toLowerCase();

    // ASCII phonemic normalization: deliberately easy for today's LLMs to
    // infer, while removing orthographic redundancy before token measurement.
    w = w
      .replace(/tsch/g, 'tsh')
      .replace(/sch/g, 'sh')
      .replace(/ph/g, 'f')
      .replace(/th/g, 't')
      .replace(/rh/g, 'r')
      .replace(/ck/g, 'k')
      .replace(/tz/g, 'z')
      .replace(/dt/g, 't')
      .replace(/ss/g, 's')
      .replace(/ß/g, 's')
      .replace(/ie/g, 'i')
      .replace(/aa/g, 'a')
      .replace(/ee/g, 'e')
      .replace(/oo/g, 'o')
      .replace(/äu/g, 'oi')
      .replace(/eu/g, 'oi');

    w = w
      .replace(/([aeiouyäöü])h(?=[^aeiouyäöü]|$)/g, '$1')
      .replace(/([bcdfghjklmnpqrstvwxyz])\1+/g, '$1');

    return w;
  }

  // Stage B receives Stage-A-normalized words, so its dictionaries must live
  // in that same representation. This was the v0.3.0 bug: die->di, while the
  // filter still looked for "die".
  const FUNCTION_WORDS_PHEN = new Set([...FUNCTION_WORDS_DE].map(deWordToPhenA));
  const KEEP_ALWAYS_PHEN = new Set([...KEEP_ALWAYS_DE].map(deWordToPhenA));

  function phenA(text) {
    if (!text || !String(text).trim()) return String(text || '');
    const { body, slots } = protect(text);
    const parts = body.split(/(QX\d+Q|\s+|[,.!?;:()\[\]{}])/g);
    const out = parts.map(part => {
      if (!part || /^\s+$/.test(part) || /^[,.!?;:()\[\]{}]$/.test(part) || /^QX\d+Q$/.test(part)) return part;
      return part.replace(/[A-Za-zÄÖÜäöüß]+/g, deWordToPhenA);
    }).join('');
    return restore(normalizeSpace(out), slots);
  }

  function reduceWordPhenB(word) {
    if (!word || /^QX\d+Q$/.test(word)) return word;
    let w = word;
    const bare = w.toLowerCase().replace(/[^a-zäöüß]/g, '');
    if (!bare) return w;
    if (KEEP_ALWAYS_PHEN.has(bare)) return w;
    if (FUNCTION_WORDS_PHEN.has(bare)) return '';

    // Predictable ending/schwa material. This is intentionally lossy and
    // should only be selected when the measured token gain justifies it.
    if (w.length > 5) w = w.replace(/en\b/g, 'n');
    if (w.length > 4) w = w.replace(/e\b/g, '');
    if (w.length > 5) w = w.replace(/er\b/g, 'r');
    return w;
  }

  function phenB(text) {
    if (!text || !String(text).trim()) return String(text || '');
    const stageA = phenA(text);
    const { body, slots } = protect(stageA);
    const parts = body.split(/(QX\d+Q|\s+|[,.!?;:()\[\]{}])/g);
    let out = parts.map(part => {
      if (!part || /^\s+$/.test(part) || /^[,.!?;:()\[\]{}]$/.test(part) || /^QX\d+Q$/.test(part)) return part;
      return part.replace(/[A-Za-zÄÖÜäöüß]+/g, reduceWordPhenB);
    }).join('');

    out = out
      .replace(/\s+(?:und)\s+/gi, '; ')
      .replace(/\s{2,}/g, ' ')
      .replace(/\s*;\s*;+/g, '; ')
      .replace(/(^|\n)\s*[,.;:]+\s*/g, '$1');

    return restore(normalizeSpace(out), slots);
  }

  function looksGerman(text) {
    const s = ` ${String(text || '').toLowerCase()} `;
    const hits = [' der ',' die ',' das ',' und ',' nicht ',' ist ',' mit ',' für ',' ich ',' du ',' wie ',' was ',' warum ',' dass ',' weil ']
      .reduce((n, token) => n + (s.includes(token) ? 1 : 0), 0);
    return hits >= 2 || /[äöüß]/i.test(s);
  }

  function candidates(text) {
    if (!looksGerman(text)) return [];
    return [
      { name: 'phen-a', text: phenA(text) },
      { name: 'phen-b', text: phenB(text) }
    ];
  }

  const api = { phenA, phenB, candidates, looksGerman, deWordToPhenA };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  globalThis.PhenCodec = api;
})();
