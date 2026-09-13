# PhoLine — PhO Token Wire

**Bilingual client-side PhO channel compression for LLM web chats.**

**Author / concept:** Christian Heinrich Hohlfeld, B.Sc.  
**ORCID:** [0009-0003-6634-9045](https://orcid.org/0009-0003-6634-9045)  
**Website:** [christianhohlfeld.com](https://christianhohlfeld.com/)  
**Research lineage:** [PhO-Compress](https://christianhohlfeld.com/Christian_Heinrich_Hohlfeld_Konstanz_PhO-Compress_v2.pdf)

PhoLine is a Chrome Manifest V3 research prototype derived from Christian Heinrich Hohlfeld's PhO-Compress work. Its purpose is not to make the visible prompt look shorter. Its purpose is to put a smaller linguistic representation on the actual transport path seen by an unchanged hosted LLM.

## Core idea

The user keeps writing normal German or English:

```text
visible composer: normal human text
```

PhoLine builds a parallel transport representation:

```text
Text
  -> language detection (DE / EN)
  -> phonetic / linguistic reduction
  -> predictable redundancy removal
  -> tokenizer-friendly English canonical stems
  -> exact token-cost gate
  -> request payload replacement
  -> hosted LLM
  -> optional ¶ response channel
  -> local browser expansion
```

The visible ChatGPT / Grok / Claude / Gemini composer is not rewritten. The extension installs a MAIN-world hook at `document_start` and intercepts page-level `fetch`, `XMLHttpRequest.send`, and `WebSocket.send`. Immediately before transmission it replaces an exact occurrence of the original prompt in the request body with the measured PhoLine channel, but only when that channel is cheaper under the configured measurement tokenizer.

This distinction is the point of the project:

```text
UI compression != channel compression
```

If the UI is shortened while the application still serializes the original sentence elsewhere, no token saving has been demonstrated. PhoLine therefore reports success only after the network hook has actually rewritten a request body.

## Why IPA itself is not the wire format

PhO-Compress starts from phonetic structure, but literal IPA is not automatically cheap in a modern BPE tokenizer. A string can contain fewer linguistic symbols and still fragment into more tokenizer IDs.

PhoLine keeps an IPA-like diagnostic path for comparison, but does not blindly send IPA. The production experiment instead uses PhO as the information filter and serializes the surviving content with common English canonical stems when a mapping exists.

The final acceptance criterion is the measured token count of the whole channel:

```text
send PhoLine channel only if tokens(channel) < tokens(raw)
otherwise send the original unchanged
```

Thus an unknown word may remain as a residual and consume more than one token; the fixed canonical stem vocabulary is separately constrained to atomic tokenizer entries, while the whole-message gate prevents a bad residual mix from making the request more expensive.

## German and English

PhoLine supports both languages in the same codec.

For German, the path combines:

```text
German input
  -> German redundancy / phonetic normalization
  -> removal of selected predictable function material
  -> canonical English transport stems where defined
  -> residual preservation for unmapped content
```

Examples of canonical transport mappings include:

```text
warum       -> why
Regierung   -> government
Kosten      -> cost
Fehler      -> bug
Lösung      -> fix
Unterschied -> diff
prüfen      -> check
erklären    -> tell
```

For English, the source is already close to the transport vocabulary, so PhoLine mainly normalizes morphology and redundant surface forms:

```text
applications   -> app
information    -> info
configuration  -> config
problems       -> issue
solutions      -> fix
currently      -> now
```

Language mode can be `Auto DE/EN`, forced German, or forced English.

## Atomic stem rule

The fixed transport codebook is checked against OpenAI's public `o200k_base` rank table. The repository CI rejects a canonical codebook atom if it is not an atomic token both as an initial token and with a leading space.

This does **not** claim that every arbitrary residual word is one token. Residuals are allowed because the codec must preserve task-relevant information. Their real cost is captured by the whole-channel measurement before transmission.

## Network interception

`page-hook.js` runs in Chrome's MAIN world before page application code whenever possible. It wraps:

- `window.fetch`
- `XMLHttpRequest.prototype.send`
- `window.WebSocket`

The isolated extension world computes and measures the channel, then exposes the current exact source/channel pair to the MAIN-world hook through page state. The hook rewrites only an exact occurrence of the measured source prompt. This gives an important stale-state safety property: if the user edits the prompt after measurement, an old channel does not match the new request body and therefore is not substituted.

The status panel distinguishes two states:

```text
Hook armed
```

means a cheaper channel has been prepared.

```text
✓ Request ersetzt via fetch
✓ Request ersetzt via xhr
✓ Request ersetzt via websocket
```

means a supported outgoing request body was actually rewritten.

Provider web applications can change transport implementations. Binary bodies, service-worker-only paths, provider-specific encodings, or references captured before the hook can require additional adapters. Therefore a green local token measurement alone is not presented as proof that a particular provider request was rewritten; the hook confirmation is separate.

## Optional response channel

PhoLine can append the compact control:

```text
reply stem ¶
```

to the already compressed request channel. This asks a cooperative model to answer as compact `¶`-separated semantic atoms rather than expanding everything into presentation prose.

Example wire response:

```text
¶cause cache race¶fix wait visible state¶risk network timing
```

The browser can render those atoms locally. Presentation HTML and labels created locally do not consume completion tokens.

This mechanism is experimental. A hosted model is not guaranteed to follow a text-level channel protocol, and provider-side hidden reasoning or framing is outside the extension's control.

## Measurement

PhoLine currently uses `o200k_base` for exact local text-token measurement. The service worker downloads and caches OpenAI's public rank table and runs tokenizer self-tests before reporting an exact count.

The UI compares at least:

```text
raw text
IPA diagnostic
PhoLine channel
```

The IPA diagnostic is deliberately shown because it demonstrates an important negative result: fewer phonetic symbols do not necessarily mean fewer BPE tokens.

### Author benchmark

The following measurements were supplied by the project author during development and motivated the network-hook architecture:

| Test | Tokens | Delta |
| --- | ---: | ---: |
| Bundestag prompt, raw | 30 | — |
| Same content, literal IPA on channel | 44 | +47% |
| PhoLine channel input | 14 | -53% |
| Same question to grok-4.5, normal response N | 127 | — |
| Same question, PhoLine response M | 18 | M/N = 0.14 / -86% |

These numbers are benchmark observations, not a universal compression guarantee. Reproducible evaluation requires the exact prompt, provider/model version, tokenizer basis, settings, and response capture. The project should keep adding fixed fixtures rather than generalizing from one result.

## What PhoLine measures — and what it does not

It can measure:

- visible source prompt text
- diagnostic phonetic/IPA representation
- generated PhoLine channel
- exact `o200k_base` text-token counts
- whether its page-level fetch/XHR/WebSocket hook actually replaced a matching request body

It cannot infer from the browser alone:

- a provider's hidden system prompt
- hidden chat framing
- tool-call tokens
- server-side cached-token accounting
- invisible reasoning tokens
- a proprietary tokenizer that differs from the measurement tokenizer
- provider transformations that occur after the browser request leaves the page

Therefore the technically correct claim is: PhoLine reduces the measured user transport string when the gate passes and confirms page-level request replacement on supported transport paths. Provider billing reduction must be measured separately for each provider/model.

## Installation

1. Open the latest GitHub Release.
2. Download `PhoLine-vX.Y.Z.zip`.
3. Extract the ZIP.
4. Open `chrome://extensions`.
5. Enable **Developer mode**.
6. Choose **Load unpacked**.
7. Select the extracted directory containing `manifest.json`.
8. Reload ChatGPT, Grok, Claude or Gemini.

The panel should show `PhoLine · network hook`. Write normally. The composer remains normal text while the panel measures the parallel channel automatically.

## Build and releases

GitHub Actions validates the JavaScript, runs codec tests, checks the fixed channel vocabulary against `o200k_base`, builds the Chrome ZIP and uploads it as an Actions artifact.

For every `v*` tag whose version matches `manifest.json`, the workflow also creates/updates a GitHub Release and attaches:

```text
PhoLine-vX.Y.Z.zip
PhoLine-vX.Y.Z.zip.sha256
```

## Architecture

```text
manifest.json
  MV3 declaration; MAIN-world hook + isolated extension scripts

page-hook.js
  pre-network fetch/XHR/WebSocket request interception

phen.js
  DE/EN detection, phonetic diagnostics, PhO reduction,
  canonical English stem channel

compressor.js
  channel contract and local ¶ expansion

tokenizer.js
  exact o200k_base rank loading, BPE counting, self-tests

background.js
  tokenizer/settings service worker

content.js
  composer observation, measurement gate, hook state bridge,
  request-rewrite confirmation, response expansion

popup.html / popup.js
  enable/language/reply-channel settings

tests/
  bilingual codec tests and tokenizer-codebook validation
```

## Privacy

PhoLine has no application backend. Codec processing and response expansion happen locally in the browser. The extension itself fetches the public tokenizer rank table used for measurement. The actual chat request continues to go to the provider the user is already using.

## Research relationship

PhoLine is an applied transport experiment derived from Christian Heinrich Hohlfeld's PhO-Compress architecture:

```text
X_Text -> G2P -> X_IPA -> E_L -> Z_Phenom -> transport
```

The browser extension does not claim to be a full scientific implementation of every PhO-Compress stage. In particular, its current G2P/phonetic logic is rule-based rather than a full pronunciation engine. Its purpose is to isolate and test the practical hypothesis that linguistic redundancy can be removed before an unchanged LLM sees the transport string, while keeping tokenizer cost as an empirical constraint instead of assuming that phonetic notation is cheap.

## Citation

> Hohlfeld, Christian Heinrich. *PhoLine — PhO Token Wire: Bilingual Pre-Tokenizer Channel Compression for LLM Web Chats*. 2026. ORCID: 0009-0003-6634-9045.

Machine-readable citation metadata is in [`CITATION.cff`](CITATION.cff).

Related work:

> Hohlfeld, Christian Heinrich. *PhO-Compress: A Two-Stage Framework to Enhance Optical LLM Context Compression*. ORCID: 0009-0003-6634-9045.

## Ownership

Copyright © 2026 Christian Heinrich Hohlfeld. All rights reserved.

No patent, copyright, trademark or other license is granted merely by publication of this repository.
