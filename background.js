'use strict';
importScripts('tokenizer.js');

const DEFAULTS = {
  enabled: true,
  compressInput: true,
  wireMode: true,
  level: 'aggressive',
  maxWords: 80,
  autoDecode: true,
  onlyIfInputSaves: false,
  schemaVersion: 2
};

chrome.runtime.onInstalled.addListener(async () => {
  const current = await chrome.storage.sync.get(null);
  const migrated = { ...DEFAULTS, ...current };

  // v0.1 shipped with safe + 140 words. If the user still has exactly
  // those legacy defaults, move them to the corrected adaptive defaults.
  if (!current.schemaVersion) {
    if (current.level === undefined || current.level === 'safe') migrated.level = 'aggressive';
    if (current.maxWords === undefined || current.maxWords === 140) migrated.maxWords = 80;
  }
  migrated.schemaVersion = 2;
  await chrome.storage.sync.set(migrated);
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === 'TOKEN_COUNT') {
    PhoTokenizer.tokenCount(String(msg.text || ''))
      .then(sendResponse)
      .catch((e) => sendResponse({ count: 0, exact: false, error: String(e) }));
    return true;
  }
  if (msg?.type === 'GET_SETTINGS') {
    chrome.storage.sync.get(DEFAULTS).then(sendResponse);
    return true;
  }
  if (msg?.type === 'SET_SETTINGS') {
    chrome.storage.sync.set(msg.settings || {}).then(() => sendResponse({ ok: true }));
    return true;
  }
});
