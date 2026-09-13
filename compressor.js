(() => {
  'use strict';

  const BACK_DE = new Map(Object.entries({
    why:'warum', how:'wie', what:'was', who:'wer', when:'wann', where:'wo', which:'welche', not:'nicht', never:'nie', without:'ohne', only:'nur', or:'oder', but:'aber', if:'wenn', because:'weil', more:'mehr', less:'weniger', with:'mit', for:'für', from:'von', to:'zu', vs:'gegen', about:'über', today:'heute', tomorrow:'morgen', yesterday:'gestern', now:'jetzt', new:'neu', last:'letzte', explain:'erklären', check:'prüfen', compare:'vergleichen', list:'auflisten', give:'geben', show:'zeigen', find:'finden', brief:'kurz', exact:'genau', key:'wichtig', cause:'Ursache', issue:'Problem', bug:'Fehler', fix:'Lösung', diff:'Unterschied', risk:'Risiko', cost:'Kosten', price:'Preis', save:'sparen', token:'Token', answer:'Antwort', question:'Frage', data:'Daten', info:'Information', system:'System', model:'Modell', ai:'KI', government:'Regierung', law:'Gesetz', market:'Markt', company:'Unternehmen', user:'Nutzer', browser:'Browser', plugin:'Plugin', extension:'Erweiterung'
  }));

  function detectLanguage(text, forced = 'auto') {
    if (forced === 'de' || forced === 'en') return forced;
    return globalThis.PhenCodec?.detectLanguage?.(text) || 'en';
  }

  function encode(input, options = {}) {
    const codec = globalThis.PhenCodec;
    const raw = String(input || '');
    if (!codec) return { raw, lang: 'en', channel: raw, ipa: raw, phonetic: raw };
    const lang = detectLanguage(raw, options.language || 'auto');
    let channel = codec.channelize(raw, lang);
    if (options.replyChannel !== false && channel) channel = `${channel} ${codec.replyControl()}`.trim();
    return {
      raw,
      lang,
      channel,
      ipa: codec.ipaProbe(raw, lang),
      phonetic: codec.phoneticCore(raw, lang)
    };
  }

  function expandAtom(atom, lang) {
    const trimmed = atom.trim();
    if (!trimmed) return '';
    if (lang !== 'de') return trimmed;
    return trimmed.split(/\s+/).map(word => BACK_DE.get(word.toLowerCase()) || word).join(' ');
  }

  function expandResponse(raw, lang = 'en') {
    const text = String(raw || '').trim();
    if (!text.startsWith('¶')) return null;
    const atoms = text.split('¶').map(x => x.trim()).filter(Boolean).map(x => expandAtom(x, lang));
    if (!atoms.length) return null;
    return atoms;
  }

  const api = { detectLanguage, encode, expandResponse };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  globalThis.PhenTokenWire = api;
})();
