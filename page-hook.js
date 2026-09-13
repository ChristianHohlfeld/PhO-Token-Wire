(() => {
  'use strict';
  if (window.__pholineHookInstalled) return;
  window.__pholineHookInstalled = true;

  const ATTR = {
    use: 'data-pholine-use',
    raw: 'data-pholine-raw',
    channel: 'data-pholine-channel',
    lang: 'data-pholine-lang'
  };

  const decoder = new TextDecoder();

  function decode64(value) {
    if (!value) return '';
    try {
      const bin = atob(value);
      const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
      return decoder.decode(bytes);
    } catch {
      return '';
    }
  }

  function state() {
    const root = document.documentElement;
    if (!root || root.getAttribute(ATTR.use) !== '1') return null;
    const raw = decode64(root.getAttribute(ATTR.raw));
    const channel = decode64(root.getAttribute(ATTR.channel));
    if (!raw || !channel || raw === channel) return null;
    return { raw, channel, lang: root.getAttribute(ATTR.lang) || 'en' };
  }

  function notify(transport, changed) {
    if (!changed) return;
    window.postMessage({ source: 'pholine-main', type: 'request-rewritten', transport }, '*');
  }

  function replaceString(value, s) {
    if (!s || typeof value !== 'string') return { value, changed: false };
    let out = value;
    let changed = false;

    if (out.includes(s.raw)) {
      out = out.split(s.raw).join(s.channel);
      changed = true;
    }

    const rawEsc = JSON.stringify(s.raw).slice(1, -1);
    const channelEsc = JSON.stringify(s.channel).slice(1, -1);
    if (rawEsc !== s.raw && out.includes(rawEsc)) {
      out = out.split(rawEsc).join(channelEsc);
      changed = true;
    }

    const rawUrl = encodeURIComponent(s.raw);
    if (rawUrl !== s.raw && out.includes(rawUrl)) {
      out = out.split(rawUrl).join(encodeURIComponent(s.channel));
      changed = true;
    }

    return { value: out, changed };
  }

  function deepReplace(value, s) {
    if (typeof value === 'string') return replaceString(value, s);
    if (Array.isArray(value)) {
      let changed = false;
      const next = value.map(item => {
        const r = deepReplace(item, s);
        changed ||= r.changed;
        return r.value;
      });
      return { value: next, changed };
    }
    if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
      let changed = false;
      const next = {};
      for (const [key, item] of Object.entries(value)) {
        const r = deepReplace(item, s);
        changed ||= r.changed;
        next[key] = r.value;
      }
      return { value: next, changed };
    }
    return { value, changed: false };
  }

  function transformString(body, s) {
    try {
      const parsed = JSON.parse(body);
      const r = deepReplace(parsed, s);
      if (r.changed) return { body: JSON.stringify(r.value), changed: true };
    } catch {}
    const r = replaceString(body, s);
    return { body: r.value, changed: r.changed };
  }

  function transformBody(body, s) {
    if (!s || body == null) return { body, changed: false };
    if (typeof body === 'string') return transformString(body, s);

    if (body instanceof URLSearchParams) {
      const next = new URLSearchParams();
      let changed = false;
      for (const [key, value] of body.entries()) {
        const r = replaceString(value, s);
        changed ||= r.changed;
        next.append(key, r.value);
      }
      return { body: changed ? next : body, changed };
    }

    if (body instanceof FormData) {
      const next = new FormData();
      let changed = false;
      for (const [key, value] of body.entries()) {
        if (typeof value === 'string') {
          const r = replaceString(value, s);
          changed ||= r.changed;
          next.append(key, r.value);
        } else {
          next.append(key, value);
        }
      }
      return { body: changed ? next : body, changed };
    }

    return { body, changed: false };
  }

  const nativeFetch = window.fetch.bind(window);
  window.fetch = async function pholineFetch(input, init) {
    const s = state();
    if (!s) return nativeFetch(input, init);

    let changed = false;
    let nextInput = input;
    let nextInit = init ? { ...init } : undefined;

    if (nextInit && Object.prototype.hasOwnProperty.call(nextInit, 'body')) {
      const r = transformBody(nextInit.body, s);
      if (r.changed) {
        nextInit.body = r.body;
        changed = true;
      }
    } else if (input instanceof Request && !['GET', 'HEAD'].includes(input.method.toUpperCase())) {
      const type = input.headers.get('content-type') || '';
      if (!type || /json|text|urlencoded/i.test(type)) {
        try {
          const body = await input.clone().text();
          const r = transformString(body, s);
          if (r.changed) {
            nextInput = new Request(input, { body: r.body });
            changed = true;
          }
        } catch {}
      }
    }

    notify('fetch', changed);
    return nativeFetch(nextInput, nextInit);
  };

  const xhrOpen = XMLHttpRequest.prototype.open;
  const xhrSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function pholineOpen(method, url, ...rest) {
    this.__pholineMethod = method;
    this.__pholineUrl = url;
    return xhrOpen.call(this, method, url, ...rest);
  };
  XMLHttpRequest.prototype.send = function pholineSend(body) {
    const s = state();
    const r = transformBody(body, s);
    notify('xhr', r.changed);
    return xhrSend.call(this, r.body);
  };

  const NativeWebSocket = window.WebSocket;
  function PhoLineWebSocket(url, protocols) {
    const ws = protocols === undefined ? new NativeWebSocket(url) : new NativeWebSocket(url, protocols);
    const nativeSend = ws.send;
    ws.send = function pholineWebSocketSend(data) {
      const s = state();
      const r = transformBody(data, s);
      notify('websocket', r.changed);
      return nativeSend.call(this, r.body);
    };
    return ws;
  }
  PhoLineWebSocket.prototype = NativeWebSocket.prototype;
  Object.setPrototypeOf(PhoLineWebSocket, NativeWebSocket);
  for (const key of ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED']) {
    Object.defineProperty(PhoLineWebSocket, key, { value: NativeWebSocket[key] });
  }
  window.WebSocket = PhoLineWebSocket;
})();
