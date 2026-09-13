'use strict';
const assert = require('assert');
const Phen = require('../phen.js');
const PhoLine = require('../compressor.js');

assert.strictEqual(Phen.detectLanguage('Warum ist die Regierung heute wichtig und was ändert sich?'), 'de');
assert.strictEqual(Phen.detectLanguage('Why is the government important today and what changed?'), 'en');

const de = PhoLine.encode('Kannst du mir bitte erklären, warum die Regierung heute mehr Kosten verursacht?', { language:'auto', replyChannel:false });
assert.strictEqual(de.lang, 'de');
assert(de.channel.includes('why'));
assert(de.channel.includes('government'));
assert(de.channel.includes('cost'));
assert(!/\b(?:die|mir|bitte)\b/i.test(de.channel));

const en = PhoLine.encode('Could you please explain why the applications are currently using more tokens?', { language:'auto', replyChannel:false });
assert.strictEqual(en.lang, 'en');
assert(en.channel.includes('why'));
assert(en.channel.includes('app'));
assert(en.channel.includes('now'));
assert(en.channel.includes('token'));

const protectedInput = 'Prüfe https://example.com/a?x=1 und `foo_bar()` genau.';
const protectedChannel = PhoLine.encode(protectedInput, { language:'de', replyChannel:false }).channel;
assert(protectedChannel.includes('https://example.com/a?x=1'));
assert(protectedChannel.includes('`foo_bar()`'));

const reply = PhoLine.encode('Warum ist das relevant?', { language:'de', replyChannel:true });
assert(reply.channel.endsWith('reply stem ¶'));

const expanded = PhoLine.expandResponse('¶why cost rise¶fix cache', 'de');
assert.deepStrictEqual(expanded, ['warum Kosten rise', 'Lösung cache']);
assert.strictEqual(PhoLine.expandResponse('normal answer', 'de'), null);

const ipaDe = Phen.ipaProbe('Schule und Tschüss', 'de');
assert(/[ʃ]/.test(ipaDe));
const ipaEn = Phen.ipaProbe('the ship', 'en');
assert(/[θʃ]/.test(ipaEn));

console.log('PhoLine codec tests: OK');
