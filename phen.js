(() => {
  'use strict';

  const PROTECTED_RE = /```[\s\S]*?```|`[^`\n]+`|https?:\/\/[^\s<>()]+|\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b|\b(?:[A-Fa-f0-9]{8,}|\d{4,})\b|"[^"\n]{1,160}"|'[^'\n]{1,160}'/g;

  const DE_HINTS = new Set(['der','die','das','und','nicht','ist','mit','für','ich','du','wie','was','warum','dass','weil','ein','eine','auch','auf','von','zu','im','am']);
  const EN_HINTS = new Set(['the','and','not','is','with','for','i','you','how','what','why','that','because','a','an','also','on','from','to','in','at']);

  const DROP = {
    de: new Set(['der','die','das','den','dem','des','ein','eine','einen','einem','einer','eines','ist','sind','war','waren','wird','werden','wurde','wurden','sein','gewesen','ich','du','er','sie','es','wir','ihr','man','auch','doch','halt','eben','eigentlich','quasi','also','sozusagen','bitte','gerne','mal','mir','mich']),
    en: new Set(['the','a','an','is','are','was','were','be','been','being','i','you','he','she','it','we','they','this','these','those','also','actually','basically','please','just','me'])
  };

  const KEEP = {
    de: new Set(['nicht','kein','keine','keinen','keinem','keiner','nie','ohne','nur','oder','aber','wenn','falls','weil','dass','als','mehr','weniger']),
    en: new Set(['not','no','never','without','only','or','but','if','unless','because','than','more','less'])
  };

  const DE_TO_STEM = new Map(Object.entries({
    'warum':'why','wie':'how','was':'what','wer':'who','wann':'when','wo':'where','welche':'which','welcher':'which','welches':'which',
    'nicht':'not','kein':'not','keine':'not','keinen':'not','keinem':'not','keiner':'not','nie':'never','ohne':'without','nur':'only','oder':'or','aber':'but','wenn':'if','falls':'if','weil':'because','dass':'that','mehr':'more','weniger':'less',
    'mit':'with','für':'for','von':'from','zu':'to','gegen':'vs','zwischen':'between','über':'about','unter':'under','nach':'after','vor':'before',
    'heute':'today','morgen':'tomorrow','gestern':'yesterday','aktuell':'now','jetzt':'now','neu':'new','neue':'new','neuen':'new','letzte':'last','letzten':'last',
    'erkläre':'explain','erklären':'explain','erklär':'explain','prüfe':'check','prüfen':'check','prüf':'check','vergleiche':'compare','vergleichen':'compare','vergleich':'compare','nenne':'list','nennen':'list','liste':'list','gib':'give','zeige':'show','zeigen':'show','finde':'find','finden':'find',
    'kurz':'brief','knapp':'brief','genau':'exact','wichtig':'key','wichtigste':'key','relevant':'relevant','grund':'cause','ursache':'cause','problem':'issue','fehler':'bug','lösung':'fix','unterschied':'diff','unterschiede':'diff','risiko':'risk','kosten':'cost','preis':'price','sparen':'save','ersparnis':'save','token':'token','tokens':'token','antwort':'answer','frage':'question','daten':'data','information':'info','informationen':'info','system':'system','modell':'model','modelle':'model','ki':'ai','künstliche':'ai','intelligenz':'ai',
    'regierung':'government','gesetz':'law','gesetze':'law','markt':'market','firma':'company','unternehmen':'company','nutzer':'user','benutzer':'user','browser':'browser','plugin':'plugin','erweiterung':'extension'
  }));

  const EN_CANON = new Map(Object.entries({
    'approximately':'approx','application':'app','applications':'app','configuration':'config','configurations':'config','difference':'diff','differences':'diff','information':'info','requirements':'needs','requirement':'need','response':'answer','responses':'answer','problem':'issue','problems':'issue','solution':'fix','solutions':'fix','because':'because','currently':'now','current':'now','important':'key','relevant':'relevant','comparison':'compare','comparing':'compare','explaining':'explain','explanation':'explain','checking':'check','checked':'check','saving':'save','savings':'save','tokens':'token','questions':'question','answers':'answer','users':'user','companies':'company','governments':'government'
  }));

  const DE_PHRASES = [
    [/\bim vergleich zu\b/gi, ' vs '], [/\bim hinblick auf\b/gi, ' about '], [/\bin bezug auf\b/gi, ' about '],
    [/\baufgrund der tatsache,? dass\b/gi, ' because '], [/\bwas ist der unterschied\b/gi, ' diff '], [/\bwie kann(?:st)?\b/gi, ' how ']
  ];
  const EN_PHRASES = [
    [/\bin order to\b/gi, ' to '], [/\bwith regard to\b/gi, ' about '], [/\bdue to the fact that\b/gi, ' because '],
    [/\bwhat is the difference\b/gi, ' diff '], [/\bcan you\b/gi, ' '], [/\bcould you\b/gi, ' ']
  ];

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
    return text.replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{2,}/g, '\n').replace(/\s+([,.;:!?])/g, '$1').trim();
  }

  function detectLanguage(text) {
    const words = String(text || '').toLowerCase().match(/[a-zäöüß']+/g) || [];
    let de = /[äöüß]/i.test(text) ? 3 : 0;
    let en = 0;
    for (const w of words) {
      if (DE_HINTS.has(w)) de++;
      if (EN_HINTS.has(w)) en++;
    }
    if (de === en) {
      if (/(?:ung|keit|heit|lich|chen)\b/i.test(text)) de++;
      if (/(?:ing|tion|ment|ness)\b/i.test(text)) en++;
    }
    return de > en ? 'de' : 'en';
  }

  function dePhonetic(word) {
    return String(word || '').toLowerCase()
      .replace(/tsch/g, 'tsh').replace(/sch/g, 'sh').replace(/ph/g, 'f').replace(/th/g, 't').replace(/rh/g, 'r')
      .replace(/ck/g, 'k').replace(/tz/g, 'z').replace(/dt/g, 't').replace(/ss/g, 's').replace(/ß/g, 's')
      .replace(/ie/g, 'i').replace(/aa/g, 'a').replace(/ee/g, 'e').replace(/oo/g, 'o').replace(/äu|eu/g, 'oi')
      .replace(/([aeiouyäöü])h(?=[^aeiouyäöü]|$)/g, '$1').replace(/([bcdfghjklmnpqrstvwxyz])\1+/g, '$1');
  }

  function enPhonetic(word) {
    return String(word || '').toLowerCase()
      .replace(/^kn/, 'n').replace(/^wr/, 'r').replace(/^wh/, 'w').replace(/tion/g, 'shn').replace(/sion/g, 'zhn')
      .replace(/tch/g, 'ch').replace(/ph/g, 'f').replace(/qu/g, 'kw').replace(/ck/g, 'k').replace(/dge/g, 'j')
      .replace(/ee/g, 'i').replace(/oo/g, 'u').replace(/igh/g, 'i').replace(/([bcdfghjklmnpqrstvwxyz])\1+/g, '$1')
      .replace(/([a-z]{3,})e$/g, '$1');
  }

  function phoneticCore(text, lang = detectLanguage(text)) {
    const { body, slots } = protect(text);
    const fn = lang === 'de' ? dePhonetic : enPhonetic;
    const out = body.replace(/[A-Za-zÄÖÜäöüß']+/g, fn);
    return restore(normalizeSpace(out), slots);
  }

  function ipaProbe(text, lang = detectLanguage(text)) {
    let out = phoneticCore(text, lang);
    if (lang === 'de') {
      out = out.replace(/tsh/g, 'tʃ').replace(/sh/g, 'ʃ').replace(/ng/g, 'ŋ').replace(/oi/g, 'ɔɪ').replace(/ch/g, 'x');
    } else {
      out = out.replace(/sh/g, 'ʃ').replace(/ch/g, 'tʃ').replace(/th/g, 'θ').replace(/ng/g, 'ŋ').replace(/zhn/g, 'ʒn');
    }
    return out;
  }

  function englishStem(word) {
    const lower = word.toLowerCase();
    if (EN_CANON.has(lower)) return EN_CANON.get(lower);
    if (KEEP.en.has(lower)) return lower;
    if (DROP.en.has(lower)) return '';
    let w = lower;
    if (w.length > 6) w = w.replace(/(?:ingly|edly)$/,'');
    if (w.length > 5) w = w.replace(/(?:ing|ed)$/,'');
    if (w.length > 4) w = w.replace(/ies$/,'y').replace(/es$/,'').replace(/s$/,'');
    return EN_CANON.get(w) || w;
  }

  function germanToStem(word) {
    const lower = word.toLowerCase();
    if (DE_TO_STEM.has(lower)) return DE_TO_STEM.get(lower);
    if (KEEP.de.has(lower)) return DE_TO_STEM.get(lower) || lower;
    if (DROP.de.has(lower)) return '';
    let w = dePhonetic(lower);
    if (w.length > 7) w = w.replace(/(?:ungen|ung)$/,'');
    if (w.length > 7) w = w.replace(/(?:keiten|keit|heiten|heit)$/,'');
    if (w.length > 6) w = w.replace(/(?:lich|isch)$/,'');
    if (w.length > 5) w = w.replace(/en$/,'n').replace(/er$/,'r').replace(/e$/,'');
    return w;
  }

  function channelize(text, lang = detectLanguage(text)) {
    if (!String(text || '').trim()) return '';
    const { body: protectedBody, slots } = protect(text);
    let body = protectedBody;
    for (const [re, replacement] of (lang === 'de' ? DE_PHRASES : EN_PHRASES)) body = body.replace(re, replacement);

    const words = body.split(/(QX\d+Q|[A-Za-zÄÖÜäöüß']+|\d+(?:[.,]\d+)?)/g);
    const out = [];
    for (const part of words) {
      if (!part || /^\s+$/.test(part)) continue;
      if (/^QX\d+Q$/.test(part)) { out.push(part); continue; }
      if (/^\d/.test(part)) { out.push(part); continue; }
      if (/^[A-Za-zÄÖÜäöüß']+$/.test(part)) {
        const stem = lang === 'de' ? germanToStem(part) : englishStem(part);
        if (stem) out.push(stem);
        continue;
      }
      if (/[?!]/.test(part)) out.push('?');
    }
    return restore(normalizeSpace(out.join(' ')).replace(/\s+\?/g, '?'), slots);
  }

  function replyControl() {
    return 'reply stems ¶';
  }

  function candidates(text) {
    const lang = detectLanguage(text);
    return {
      lang,
      raw: String(text || ''),
      phonetic: phoneticCore(text, lang),
      ipa: ipaProbe(text, lang),
      channel: channelize(text, lang)
    };
  }

  const api = { detectLanguage, phoneticCore, ipaProbe, channelize, replyControl, candidates, dePhonetic, enPhonetic };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  globalThis.PhenCodec = api;
})();
