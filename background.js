'use strict';
importScripts('tokenizer.js');

const DEFAULTS = {
  enabled: true,
  language: 'auto',
  replyChannel: true,
  decodeReplies: true,
  schemaVersion: 4
};

chrome.runtime.onInstalled.addListener(async () => {
  const current = await chrome.storage.sync.get(null);
  await chrome.storage.sync.set({
    enabled: current.enabled ?? DEFAULTS.enabled,
    language: ['auto','de','en'].includes(current.language) ? current.language : DEFAULTS.language,
    replyChannel: current.replyChannel ?? DEFAULTS.replyChannel,
    decodeReplies: current.decodeReplies ?? DEFAULTS.decodeReplies,
    schemaVersion: 4
  });
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === 'TOKEN_COUNT') {
    PhoTokenizer.tokenCount(String(msg.text || ''))
      .then(sendResponse)
      .catch(error => sendResponse({ count: 0, exact: false, error: String(error) }));
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
