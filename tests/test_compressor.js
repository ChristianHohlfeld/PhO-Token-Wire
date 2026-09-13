'use strict';
const assert = require('assert');
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

const parsed = PTW.parseWire('K:Problem erkannt\nF:A|B\nU:nur falls C\nN:X tun');
assert.deepStrictEqual(parsed.K, ['Problem erkannt']);
assert.deepStrictEqual(parsed.F, ['A','B']);
assert.deepStrictEqual(parsed.N, ['X tun']);

const rendered = PTW.renderWire(parsed, 'de');
assert(rendered.includes('Problem erkannt'));
assert(rendered.includes('<li>A</li>'));

console.log('compressor tests: OK');
