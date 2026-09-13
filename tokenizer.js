'use strict';

const O200K_URL = 'https://openaipublic.blob.core.windows.net/encodings/o200k_base.tiktoken';
const CACHE_NAME = 'pho-token-wire-v1';
const te = new TextEncoder();
let ranksPromise = null;

function bytesKey(bytes) {
  let s = '';
  const CHUNK = 8192;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    s += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return s;
}

function b64ToKey(b64) {
  const bin = atob(b64);
  return bin;
}

async function getRanks() {
  if (ranksPromise) return ranksPromise;
  ranksPromise = (async () => {
    const cache = await caches.open(CACHE_NAME);
    let response = await cache.match(O200K_URL);
    if (!response) {
      response = await fetch(O200K_URL, { cache: 'force-cache' });
      if (!response.ok) throw new Error(`Tokenizer data HTTP ${response.status}`);
      await cache.put(O200K_URL, response.clone());
    }
    const text = await response.text();
    const ranks = new Map();
    for (const line of text.split('\n')) {
      if (!line) continue;
      const sp = line.lastIndexOf(' ');
      if (sp < 1) continue;
      const key = b64ToKey(line.slice(0, sp));
      const rank = Number(line.slice(sp + 1));
      ranks.set(key, rank);
    }
    return ranks;
  })();
  return ranksPromise;
}

const contraction = "(?:'[sS]|'[tT]|'[rR][eE]|'[vV][eE]|'[mM]|'[lL][lL]|'[dD])?";
const PAT = new RegExp([
  `[^\\r\\n\\p{L}\\p{N}]?[\\p{Lu}\\p{Lt}\\p{Lm}\\p{Lo}\\p{M}]*[\\p{Ll}\\p{Lm}\\p{Lo}\\p{M}]+${contraction}`,
  `[^\\r\\n\\p{L}\\p{N}]?[\\p{Lu}\\p{Lt}\\p{Lm}\\p{Lo}\\p{M}]+[\\p{Ll}\\p{Lm}\\p{Lo}\\p{M}]*${contraction}`,
  `\\p{N}{1,3}`,
  ` ?[^\\s\\p{L}\\p{N}]+[\\r\\n/]*`,
  `\\s*[\\r\\n]+`,
  `\\s+(?!\\S)`,
  `\\s+`
].join('|'), 'gu');

function countPiece(piece, ranks) {
  const bytes = te.encode(piece);
  const whole = bytesKey(bytes);
  if (ranks.has(whole)) return 1;

  let parts = Array.from(bytes, b => String.fromCharCode(b));
  while (parts.length > 1) {
    let bestIndex = -1;
    let bestRank = Infinity;
    for (let i = 0; i < parts.length - 1; i++) {
      const rank = ranks.get(parts[i] + parts[i + 1]);
      if (rank !== undefined && rank < bestRank) {
        bestRank = rank;
        bestIndex = i;
      }
    }
    if (bestIndex < 0) break;
    parts.splice(bestIndex, 2, parts[bestIndex] + parts[bestIndex + 1]);
  }
  return parts.length;
}

function countWithRanks(text, ranks) {
  let count = 0;
  PAT.lastIndex = 0;
  let matched = 0;
  let m;
  while ((m = PAT.exec(text)) !== null) {
    if (m.index > matched) count += countPiece(text.slice(matched, m.index), ranks);
    count += countPiece(m[0], ranks);
    matched = PAT.lastIndex;
  }
  if (matched < text.length) count += countPiece(text.slice(matched), ranks);
  return count;
}

let selfTested = false;
function runSelfTest(ranks) {
  if (selfTested) return;
  const vectors = [
    ['antidisestablishmentarianism', 6],
    ['2 + 2 = 4', 7],
    ['お誕生日おめでとう', 8]
  ];
  for (const [text, expected] of vectors) {
    const got = countWithRanks(text, ranks);
    if (got !== expected) throw new Error(`o200k self-test failed: expected ${expected}, got ${got} for ${text}`);
  }
  selfTested = true;
}

async function countO200k(text) {
  const ranks = await getRanks();
  runSelfTest(ranks);
  return countWithRanks(text, ranks);
}

function fallbackEstimate(text) {
  const bytes = te.encode(text).length;
  const words = (text.match(/[\p{L}\p{N}]+/gu) || []).length;
  const punct = (text.match(/[^\s\p{L}\p{N}]/gu) || []).length;
  return Math.max(1, Math.ceil(bytes / 4), Math.ceil(words * 1.15 + punct * 0.35));
}

async function tokenCount(text) {
  try {
    return { count: await countO200k(text), exact: true, encoding: 'o200k_base' };
  } catch (error) {
    return { count: fallbackEstimate(text), exact: false, encoding: 'fallback', error: String(error?.message || error) };
  }
}

self.PhoTokenizer = { tokenCount, fallbackEstimate };
