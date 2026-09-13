# PhO Token Wire

**Measured client-side PhO compression for LLM web chats — by Christian Heinrich Hohlfeld.**

**Author / concept:** Christian Heinrich Hohlfeld, B.Sc.  
**ORCID:** [0009-0003-6634-9045](https://orcid.org/0009-0003-6634-9045)  
**Website:** [christianhohlfeld.com](https://christianhohlfeld.com/)  
**Research lineage:** [PhO-Compress — A Two-Stage Framework to Enhance Optical LLM Context Compression](https://christianhohlfeld.com/Christian_Heinrich_Hohlfeld_Konstanz_PhO-Compress_v2.pdf)

PhO Token Wire is an experimental Chrome Manifest V3 extension that asks a practical question:

> Can an unchanged hosted LLM receive and return less text while preserving the task-relevant information, if linguistic redundancy is removed before the tokenizer sees it?

The implementation follows a central distinction from Christian Heinrich Hohlfeld's PhO-Compress research direction: **first reduce redundant information; then evaluate the transport representation in the currency that the model actually pays for — tokenizer tokens.**

The extension therefore never assumes that fewer characters automatically mean fewer tokens. Every candidate representation is measured against the original prompt with `o200k_base`, and the browser selects only the lowest measured token count.

## What changed in v0.3.1

The original v0.1 prototype had a conceptual implementation error: it mostly performed phrase rewrites such as `aufgrund der Tatsache, dass -> weil`, then appended a large K/F/U/N wire instruction to every prompt. A real test showed the problem immediately:

```text
Prompt: 283 -> 281     only 2 input tokens saved
with wire: 389         108 tokens of control overhead
```

That was not a meaningful implementation of the PhO idea.

v0.3.1 changes the architecture:

1. The browser generates several competing representations of the same prompt.
2. Two of them are explicit PhO candidates:
   - **Phen-A:** graphemic redundancy -> compact, model-readable phonemic ASCII normalization.
   - **Phen-B:** Phen-A plus removal of predictable phonetic / grammatical surface material.
3. All candidates are counted with `o200k_base`.
4. The lowest real token count wins.
5. The answer-control prompt is intentionally tiny instead of a 100+ token schema.
6. The UI shows all candidate token counts and the reply break-even.

This makes the experiment falsifiable: if Phen-A or Phen-B does not beat ordinary text for a prompt, it is not used.

## Core architecture

```text
original prompt
   |
   +--> safe rewrite
   |
   +--> aggressive semantic rewrite
   |
   +--> Phen-A: grapheme -> phonemic ASCII core
   |
   +--> Phen-B: Phen-A -> predictive / redundant material removed
   |
   v
exact o200k measurement of every candidate
   |
   v
lowest-token representation only
   |
   +--> tiny terse-reply hint
   |
   v
hosted LLM
   |
   v
compact fragment reply
   |
   v
local browser rendering
```

The browser therefore separates three layers:

1. **Information layer** — what information still has to survive for the task?
2. **Transport layer** — which representation uses the fewest real tokenizer tokens?
3. **Presentation layer** — which words / formatting can be restored locally without spending completion tokens?

## Input candidates

### Original

No transformation. This is always kept as a candidate and acts as the safety baseline.

### Safe

Conservative deterministic phrase reduction outside protected spans.

Examples:

```text
aufgrund der Tatsache, dass -> weil
in Bezug auf                -> zu
in order to                 -> to
```

Code, URLs, email addresses, quoted literals and long IDs are protected from generic rewriting.

### Aggressive

Removes additional grammatical surface redundancy while preserving negation, code, numbers and other protected payload.

This is intentionally lossy and intended for S-sufficient communication rather than orthographically exact reconstruction.

### Phen-A

Phen-A is the first explicitly phonetic candidate.

It removes orthographic distinctions that often carry little or no additional phonetic information. Examples of the current deterministic German normalization include:

```text
tsch -> tsh
sch  -> sh
ph   -> f
th   -> t
ck   -> k
tz   -> z
dt   -> t
ss/ß -> s
ie   -> i
double consonants -> single consonant
selected orthographic h length markers -> removed
```

This is intentionally **ASCII and model-readable**, not literal IPA. The reason is practical: a standard LLM already has strong priors for Latin text, while IPA can fragment badly under a BPE tokenizer.

Phen-A is therefore best understood as a browser-side phonemic normalization experiment, not as a complete linguistic G2P engine.

### Phen-B

Phen-B starts from Phen-A and removes additional predictable material:

- frequent grammatical function words,
- selected schwa-like / predictable endings,
- duplicate grammatical surface material,
- some conjunction surface cost.

Negation and decision-changing operators such as `nicht`, `kein`, `ohne`, `nur`, `oder`, `aber`, `wenn`, `falls`, `weil` are explicitly retained.

Phen-B is intentionally lossy in form. Its research target is task sufficiency, not exact orthographic reconstruction.

## Why candidate measurement matters

Character reduction alone is meaningless for API/context cost.

For example, a visually shorter pseudo-phonetic form may split into more BPE pieces than the original German word. Therefore PhO Token Wire does not use a transform because it *looks* compressed.

It evaluates:

```text
T_original
T_safe
T_aggressive
T_phen_a
T_phen_b
```

and selects:

```text
argmin(T_candidate)
```

The UI displays the actual counts, e.g.:

```text
original:283 | safe:281 | aggressive:244 | phen-a:267 | phen-b:221
selected phen-b: 283 -> 221 (-62, -21.9%)
```

If `phen-a` or `phen-b` loses, it is not selected.

That is the important experimental discipline: **PhO has to win in token space, not in character space.**

## Completion-side compression

The old K/F/U/N instruction was too expensive because its control language could cost more than the input reduction.

The current reply hint is intentionally small:

```text
Telegrammstil; <=80 Wörter; Punkte mit |.
```

The model stays in ordinary learned vocabulary. The `|` separator only marks semantic fragments. The browser can render those fragments locally as bullets.

The UI shows the exact extra input cost of this hint and the completion break-even:

```text
Reply-Hinweis +11; gesendet 232; Break-even 0
```

or, if the hint temporarily pushes the prompt above the original:

```text
Reply-Hinweis +11; gesendet 289; Break-even 6
```

In the second case, the answer only needs to become more than six completion tokens shorter for the combined prompt+completion path to win.

## Protected information / U principle

PhO-Compress separates compressible linguistic structure from information that must survive exactly. PhO Token Wire currently implements the practical browser-side version of that idea by protecting such spans inline instead of forcing them through phonetic rewriting.

Protected examples include:

- fenced code blocks,
- inline code,
- URLs,
- email addresses,
- quoted literals,
- long numeric identifiers,
- long hexadecimal identifiers.

A future version can move those protected spans into an explicit side-channel `U` only when doing so itself passes the tokenizer-cost gate.

## Installation

1. Clone or download this repository.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select the repository folder.
6. Reload ChatGPT, Claude, Gemini or Grok.

The in-page widget shows **Token optimieren**.

Write your prompt first. Clicking the button does **not** send anything. It replaces the composer with the cheapest measured representation and shows the token accounting. You decide whether to press Send.

## Recommended settings

Current defaults:

```text
Input adaptiv kürzen: ON
Kompression: aggressiv/adaptiv
Antwort knapp halten: ON
Antwortlimit: 80 Wörter
```

Use `safe` when semantic fidelity matters more than token reduction. Use `aggressiv/adaptiv` when you explicitly want to test Phen-A / Phen-B.

## Supported web chats

Current DOM integrations:

- ChatGPT — `chatgpt.com`, legacy `chat.openai.com`
- Claude — `claude.ai`
- Gemini — `gemini.google.com`
- Grok — `grok.com`

These are browser integrations, not official provider plugins. DOM changes can require selector updates.

## Token measurement

The service worker downloads and caches OpenAI's public `o200k_base.tiktoken` rank table:

```text
https://openaipublic.blob.core.windows.net/encodings/o200k_base.tiktoken
```

Before reporting an exact value, the local tokenizer implementation runs known self-test vectors.

Measured:

- original visible prompt,
- every transformed prompt candidate,
- final visible outgoing prompt,
- reply-hint overhead.

Not visible to the extension:

- hidden provider system prompts,
- provider-specific chat framing,
- cached-token accounting,
- hidden tool calls,
- provider-side reasoning,
- model tokenizers different from `o200k_base`.

Accordingly, the extension reports **measured transport-text savings**, not guaranteed billing savings for every provider.

## Files

```text
phen.js
  Phen-A and Phen-B German experimental codec
  protected spans
  phonemic normalization
  predictable-material reduction

compressor.js
  safe/aggressive candidates
  integrates Phen-A / Phen-B candidates
  compact reply hint
  fragment parser / renderer

content.js
  detects the web-chat composer
  measures every candidate
  chooses only the cheapest real token representation
  displays candidate counts and break-even
  locally renders compact fragment replies

tokenizer.js
  o200k rank loading / cache
  local BPE counting
  tokenizer self-tests

background.js
  Chrome service-worker bridge
  settings and tokenizer calls

popup.html / popup.js
  extension controls

tests/test_compressor.js
  deterministic codec / compressor tests

.github/workflows/test.yml
  syntax + unit tests on push / pull request
```

## Testing

Run locally:

```bash
node --check phen.js
node --check compressor.js
node --check content.js
node --check background.js
node tests/test_compressor.js
```

For research-quality evaluation, use a corpus of real prompts and record:

```text
input_tokens_original
input_tokens_safe
input_tokens_aggressive
input_tokens_phen_a
input_tokens_phen_b
selected_representation
output_tokens_baseline
output_tokens_compact
semantic_task_success
```

Useful metrics:

```text
input_saving  = 1 - selected/original
output_saving = 1 - compact/baseline
total_saving  = 1 - (selected + compact)/(original + baseline)
```

The research target is not "short text". It is:

```text
task-relevant information / tokenizer token
```

## Current limitations

- Phen-A is a deterministic German phonemic approximation, not a production G2P engine such as eSpeak-ng.
- Phen-B is intentionally lossy.
- German names and homophones are not fully represented by an explicit orthographic side-channel yet.
- `o200k_base` is not the tokenizer used by every hosted model.
- A hosted model can ignore or partially follow the compact reply instruction.
- The extension cannot directly set provider-side `max_output_tokens` through the normal consumer web UI.
- Local response rehydration currently restores presentation structure, not every omitted grammatical word.
- Provider DOM changes can break integration selectors.

These limitations are important: v0.3.1 is now testing the correct architectural question, but it is still a research prototype rather than a finished universal codec.

## Research roadmap

1. Replace the deterministic German Phen-A approximation with a bundled client-side G2P engine while preserving the exact token gate.
2. Add a measured `U` side-channel for names, numbers, code and orthographic distinctions.
3. Add a phoneme-predictive residual coder and compare it against ordinary semantic pruning.
4. Learn a tokenizer-native compact alphabet from already-atomic/high-frequency tokens.
5. Benchmark semantic task fidelity versus token reduction over a fixed corpus.
6. Add provider-specific tokenizers where vocabularies are available.
7. Measure total input+completion savings rather than only prompt savings.

## Relationship to PhO-Compress

PhO Token Wire is an applied browser-side experiment derived from Christian Heinrich Hohlfeld's broader PhO-Compress research direction.

PhO-Compress proposes reducing linguistic redundancy before a later representation/compression stage. PhO Token Wire applies the same first-principles separation to unchanged hosted LLMs:

```text
linguistic redundancy removal
        before
transport-token optimization
```

The extension does not claim to be a complete implementation of the full optical PhO-Compress pipeline. It specifically tests the client-side linguistic / transport part.

## Attribution and citation

**PhO Token Wire — concept and project by Christian Heinrich Hohlfeld.**

Recommended citation:

> Hohlfeld, Christian Heinrich. *PhO Token Wire: Measured Client-Side Phonetic and Semantic Token Reduction for LLM Web Chats*. 2026. ORCID: 0009-0003-6634-9045.

Machine-readable citation metadata is available in [`CITATION.cff`](CITATION.cff).

Related work by the same author:

> Hohlfeld, Christian Heinrich. *PhO-Compress: A Two-Stage Framework to Enhance Optical LLM Context Compression*. v2, 25 October 2025. ORCID: 0009-0003-6634-9045.

Author profile: [christianhohlfeld.com](https://christianhohlfeld.com/)  
ORCID record: [orcid.org/0009-0003-6634-9045](https://orcid.org/0009-0003-6634-9045)

## Ownership

Copyright © 2026 Christian Heinrich Hohlfeld. All rights reserved.

No patent, copyright, trademark or other license is granted merely by publication of this repository. A separate license can be added by the author if and when desired.
