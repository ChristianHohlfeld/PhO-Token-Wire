(() => {
  'use strict';

  function detectLanguage(text) {
    return globalThis.PhenCodec?.detectLanguage?.(text) || 'en';
  }

  function inputCandidates(input) {
    const seen = new Set();
    const out = [];
    const add = (candidate) => {
      const text = String(candidate.text || '').trim();
      if (!text || seen.has(text)) return;
      seen.add(text);
      out.push({ ...candidate, text });
    };

    add({ name: 'original', lang: detectLanguage(input), stage: 'raw', text: input });
    const codec = globalThis.PhenCodec;
    if (codec?.candidates) {
      for (const candidate of codec.candidates(input)) add(candidate);
    }
    return out;
  }

  function encode(input, stage = 'B') {
    const codec = globalThis.PhenCodec;
    if (!codec) return String(input || '');
    const lang = codec.detectLanguage(input);
    return stage === 'A' ? codec.phenA(input, lang) : codec.phenB(input, lang);
  }

  const api = { detectLanguage, inputCandidates, encode };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  globalThis.PhenTokenWire = api;
})();
