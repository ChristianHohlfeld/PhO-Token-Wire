(() => {
  'use strict';

  const PROTECTED_RE = /```[\s\S]*?```|`[^`\n]+`|https?:\/\/[^\s<>()]+|\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b|\b(?:[A-Fa-f0-9]{8,}|\d{4,})\b|"[^"\n]{1,160}"|'[^'\n]{1,160}'/g;

  const DE_HINTS = new Set(['der','die','das','und','nicht','ist','mit','für','ich','du','wie','was','warum','dass','weil','ein','eine','auch','auf','von','zu']);
  const EN_HINTS = new Set(['the','and','not','is','with','for','i','you','how','what','why','that','because','a','an','also','on','from','to']);

  const FUNCTION_WORDS = {
    de: new Set(['der','die','das','den','dem','des','ein','eine','einen','einem','einer','eines','ist','sind','war','waren','wird','werden','wurde','wurden','sein','gewesen','ich','du','er','sie','es','wir','ihr','man','auch','doch','halt','eben','eigentlich','quasi','also','sozusagen','bitte','gerne','mal']),
    en: new Set(['the','a','an','is','are','was','were','be','been','being','i','you','he','she','it','we','they','this','these','those','also','actually','basically','please','just'])
  };

  const KEEP_ALWAYS = {
    de: new Set(['nicht','kein','keine','keinen','keinem','keiner','nie','ohne','nur','oder','aber','wenn','falls','weil','dass','als','mehr','weniger']),
    en: new Set(['not','no','never','without','only','or','but','if','unless','because','than','more','less'])
  };

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

  function detectLanguage(text) {
    const words = (String(text || '').toLowerCase().match(/[a-zäöüß']+/g) || []);
    let de = /[äöüß]/i.test(text) ? 3 : 0;
    let en = 0;
    for (const w of words) {
      if (DE_HINTS.has(w)) de += 1;
      if (EN_HINTS.has(w)) en += 1;
    }
    if (de === en) {
      if (/\b(?:sch|ung|keit|lich|chen)\b/i.test(text)) de += 1;
      if (/\b(?:ing|tion|th|wh)\w*/i.test(text)) en += 1;
    }
    return de > en ? 'de' : 'en';
  }

  function deWordToPhenA(word) {
    let w = String(word || '').toLowerCase();
    return w
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
      .replace(/äu|eu/g, 'oi')
      .replace(/([aeiouyäöü])h(?=[^aeiouyäöü]|$)/g, '$1')
      .replace(/([bcdfghjklmnpqrstvwxyz])\1+/g, '$1');
  }

  function enWordToPhenA(word) {
    let w = String(word || '').toLowerCase();
    return w
      .replace(/^kn/, 'n')
      .replace(/^wr/, 'r')
      .replace(/^wh/, 'w')
      .replace(/tion/g, 'shn')
      .replace(/sion/g, 'zhn')
      .replace(/tch/g, 'ch')
      .replace(/ph/g, 'f')
      .replace(/qu/g, 'kw')
      .replace(/ck/g, 'k')
      .replace(/dge/g, 'j')
      .replace(/ee/g, 'i')
      .replace(/oo/g, 'u')
      .replace(/igh/g, 'i')
      .replace(/([bcdfghjklmnpqrstvwxyz])\1+/g, '$1')
      .replace(/([a-z]{3,})e$/g, '$1');
  }

  function wordToPhenA(word, lang) {
    if (!word || /^QX\d+Q$/.test(word)) return word;
    return lang === 'de' ? deWordToPhenA(word) : enWordToPhenA(word);
  }

  function phenA(text, lang = detectLanguage(text)) {
    if (!text || !String(text).trim()) return String(text || '');
    const { body, slots } = protect(text);
    const parts = body.split(/(QX\d+Q|\s+|[,.!?;:()\[\]{}])/g);
    const out = parts.map(part => {
      if (!part || /^\s+$/.test(part) || /^[,.!?;:()\[\]{}]$/.test(part) || /^QX\d+Q$/.test(part)) return part;
      return part.replace(/[A-Za-zÄÖÜäöüß']+/g, w => wordToPhenA(w, lang));
    }).join('');
    return restore(normalizeSpace(out), slots);
  }

  function normalizedSet(set, lang) {
    return new Set([...set].map(w => wordToPhenA(w, lang)));
  }

  const FUNCTION_PHEN = {
    de: normalizedSet(FUNCTION_WORDS.de, 'de'),
    en: normalizedSet(FUNCTION_WORDS.en, 'en')
  };
  const KEEP_PHEN = {
    de: normalizedSet(KEEP_ALWAYS.de, 'de'),
    en: normalizedSet(KEEP_ALWAYS.en, 'en')
  };

  function reduceWordPhenB(word, lang) {
    if (!word || /^QX\d+Q$/.test(word)) return word;
    let w = word;
    const bare = w.toLowerCase().replace(/[^a-zäöüß']/g, '');
    if (!bare) return w;
    if (KEEP_PHEN[lang].has(bare)) return w;
    if (FUNCTION_PHEN[lang].has(bare)) return '';

    if (lang === 'de') {
      if (w.length > 5) w = w.replace(/en\b/g, 'n');
      if (w.length > 4) w = w.replace(/e\b/g, '');
      if (w.length > 5) w = w.replace(/er\b/g, 'r');
    } else {
      if (w.length > 5) w = w.replace(/ing\b/g, 'n');
      if (w.length > 4) w = w.replace(/ed\b/g, 'd');
      if (w.length > 4) w = w.replace(/es\b/g, 's');
    }
    return w;
  }

  function phenB(text, lang = detectLanguage(text)) {
    if (!text || !String(text).trim()) return String(text || '');
    const stageA = phenA(text, lang);
    const { body, slots } = protect(stageA);
    const parts = body.split(/(QX\d+Q|\s+|[,.!?;:()\[\]{}])/g);
    let out = parts.map(part => {
      if (!part || /^\s+$/.test(part) || /^[,.!?;:()\[\]{}]$/.test(part) || /^QX\d+Q$/.test(part)) return part;
      return part.replace(/[A-Za-zÄÖÜäöüß']+/g, w => reduceWordPhenB(w, lang));
    }).join('');

    out = out
      .replace(/\s+(?:und|and)\s+/gi, '; ')
      .replace(/\s{2,}/g, ' ')
      .replace(/\s*;\s*;+/g, '; ')
      .replace(/(^|\n)\s*[,.;:]+\s*/g, '$1');

    return restore(normalizeSpace(out), slots);
  }

  function candidates(text) {
    const lang = detectLanguage(text);
    return [
      { name: `phen-a-${lang}`, lang, stage: 'A', text: phenA(text, lang) },
      { name: `phen-b-${lang}`, lang, stage: 'B', text: phenB(text, lang) }
    ];
  }

  const api = { detectLanguage, phenA, phenB, candidates, deWordToPhenA, enWordToPhenA };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  globalThis.PhenCodec = api;
})();
