'use strict';
const assert = require('assert');
require('../phen.js');
const PTW = require('../compressor.js');

const src = 'Kannst du mir bitte in Bezug auf das Deployment erklären, aufgrund der Tatsache, dass nginx neu gestartet wurde?';
const compressed = PTW.compressInput(src, 'safe');
assert(!/Kannst du mir bitte/i.test(compressed));
assert(/zu das Deployment/i.test(compressed) || /zum Deployment/i.test(compressed));
assert(/weil/i.test(compressed));

const protectedSrc = 'Bitte prüfe `foo  bar` und https://example.com/a?x=1 sowie ```js\nconst  x = 1;\n```';
const protectedOut = PTW.compressInput(protectedSrc, 'safe');
assert(protectedOut.includes('`foo  bar`'));
assert(protectedOut.includes('https://example.com/a?x=1'));
assert(protectedOut.includes('```js\nconst  x = 1;\n```'));

const candidates = PTW.inputCandidates('Warum ist die Schreibung eigentlich redundant und wie können wir die Phoneme komprimieren?', 'aggressive');
assert(candidates.some(x => x.name === 'phen-a'));
assert(candidates.some(x => x.name === 'phen-b'));
assert(candidates.some(x => x.name === 'original'));

const hint = PTW.responseHint('de', 80);
assert(hint.length < 80);
assert(hint.includes('80'));
assert(hint.includes('|'));

const fragments = PTW.parseFragments('Kernpunkt | zweiter Punkt | nächster Schritt');
assert.deepStrictEqual(fragments, ['Kernpunkt','zweiter Punkt','nächster Schritt']);
assert(PTW.renderFragments(fragments).includes('<li>Kernpunkt</li>'));

const parsed = PTW.parseWire('K:Problem erkannt\nF:A|B\nU:nur falls C\nN:X tun');
assert.deepStrictEqual(parsed.K, ['Problem erkannt']);
assert.deepStrictEqual(parsed.F, ['A','B']);
assert.deepStrictEqual(parsed.N, ['X tun']);

console.log('compressor tests: OK');
