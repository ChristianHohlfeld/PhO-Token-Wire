'use strict';
const ids = ['enabled','language','replyChannel','decodeReplies'];
const defaults = { enabled:true, language:'auto', replyChannel:true, decodeReplies:true };

async function load() {
  const settings = await chrome.storage.sync.get(defaults);
  for (const id of ids) {
    const el = document.getElementById(id);
    if (!el) continue;
    el[el.type === 'checkbox' ? 'checked' : 'value'] = settings[id];
  }
}

async function save() {
  const out = {};
  for (const id of ids) {
    const el = document.getElementById(id);
    if (!el) continue;
    out[id] = el.type === 'checkbox' ? el.checked : el.value;
  }
  await chrome.storage.sync.set(out);
  const status = document.getElementById('status');
  status.textContent = 'gespeichert';
  setTimeout(() => status.textContent = '', 800);
}

document.addEventListener('DOMContentLoaded', async () => {
  await load();
  for (const id of ids) document.getElementById(id)?.addEventListener('change', save);
});
