'use strict';
const assert = require('assert');
const Phen = require('../phen.js');

const URL = 'https://openaipublic.blob.core.windows.net/encodings/o200k_base.tiktoken';

(async () => {
  const response = await fetch(URL);
  assert(response.ok, `o200k table HTTP ${response.status}`);
  const ranks = new Set();
  for (const line of (await response.text()).split('\n')) {
    if (!line) continue;
    const encoded = line.slice(0, line.lastIndexOf(' '));
    ranks.add(Buffer.from(encoded, 'base64').toString('hex'));
  }

  const atomic = text => ranks.has(Buffer.from(text, 'utf8').toString('hex'));
  const vocab = Phen.channelVocabulary();
  const badPlain = vocab.filter(word => !atomic(word));
  const badSpaced = vocab.filter(word => !atomic(` ${word}`));

  assert.deepStrictEqual(badPlain, [], `non-atomic initial stems: ${badPlain.join(', ')}`);
  assert.deepStrictEqual(badSpaced, [], `non-atomic spaced stems: ${badSpaced.join(', ')}`);
  console.log(`o200k channel vocabulary: ${vocab.length}/${vocab.length} atomic plain + spaced`);
})().catch(error => {
  console.error(error);
  process.exit(1);
});
