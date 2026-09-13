'use strict';
const ids = ['enabled','compressInput','wireMode','autoDecode','level','maxWords','onlyIfInputSaves'];
const defaults = { enabled:true, compressInput:true, wireMode:true, autoDecode:true, level:'safe', maxWords:140, onlyIfInputSaves:false };

async function load() {
  const s = await chrome.storage.sync.get(defaults);
  for (const id of ids) {
    const el = document.getElementById(id);
    el[el.type === 'checkbox' ? 'checked' : 'value'] = s[id];
  }
}

async function save() {
  const out = {};
  for (const id of ids) {
    const el = document.getElementById(id);
    out[id] = el.type === 'checkbox' ? el.checked : (el.type === 'number' ? Number(el.value) : el.value);
  }
  await chrome.storage.sync.set(out);
  const st = document.getElementById('status');
  st.textContent = 'gespeichert';
  setTimeout(() => st.textContent = '', 900);
}

document.addEventListener('DOMContentLoaded', async () => {
  await load();
  for (const id of ids) document.getElementById(id).addEventListener('change', save);
});
