'use strict';
importScripts('tokenizer.js');

const DEFAULTS = {
  enabled: true,
  compressInput: true,
  wireMode: true,
  level: 'aggressive',
  maxWords: 80,
  autoDecode: true,
  onlyIfInputSaves: false
};

chrome.runtime.onInstalled.addListener(async () => {
  const current = await chrome.storage.sync.get(DEFAULTS);
  await chrome.storage.sync.set({ ...DEFAULTS, ...current });
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
