# LinguaFlow — Multilingual Translation App

A production-grade, fully responsive multilingual translation web application built with plain HTML, CSS and JavaScript.

---

## Live Preview

Open `index.html` in any modern browser — no installation required.

---

## Features

| Feature | Detail |
|---|---|
| **Translation** | MyMemory API — free, no key needed |
| **Default load** | "Hello, how are you" → French on page open |
| **500-char limit** | Colour-coded counter (grey → yellow → red) |
| **Translate button** | Manual trigger with loading state |
| **Real-time debounce** | Translates 750ms after you stop typing |
| **Language detection** | "Detect Language" option with detected-language badge |
| **18 languages** | EN, FR, ES, DE, IT, PT, RU, ZH, JA, AR, KO, NL, SV, PL, TR, HI, VI, TH |
| **Swap languages** | Swaps selectors + text, re-translates |
| **Text-to-Speech** | Listen to input and output in correct locale |
| **Copy buttons** | Clipboard API with tick confirmation |
| **Loading indicator** | Shimmer skeleton + button spinner |
| **Error handling** | Inline error text + toast notification |
| **Translation history** | Last 5 translations as clickable chips |
| **Dark / Light mode** | Toggle with localStorage persistence |
| **Responsive** | Works on desktop, tablet, and mobile |
| **Keyboard shortcuts** | Ctrl+Enter to translate, Esc to clear |
| **Accessibility** | ARIA labels, focus rings, reduced-motion support |

---

## File Structure

```
linguaflow/
├── index.html   — HTML structure (semantic, ARIA-labelled)
├── style.css    — All styles (CSS variables, animations, responsive)
├── script.js    — All JavaScript (19 documented sections)
└── README.md    — This file
```

---

## Running Locally

No build step, bundler, or package manager needed.

```bash
# Option 1 — just open directly
open index.html

# Option 2 — serve locally (avoids any CORS edge cases)
npx serve .

# Option 3 — Python server
python3 -m http.server 8080
# then visit http://localhost:8080
```

---

## API Details

**Endpoint:** `https://api.mymemory.translated.net/get`

**Method:** GET

**Parameters:**
- `q` — URL-encoded source text
- `langpair` — e.g. `en|fr`, `autodetect|es`

**Example request:**
```
GET https://api.mymemory.translated.net/get?q=Hello&langpair=en%7Cfr
```

**Example response:**
```json
{
  "responseStatus": 200,
  "responseData": {
    "translatedText": "Bonjour",
    "detectedLanguage": null
  }
}
```

**Rate limit:** ~5,000 words/day per IP on the free tier. No API key required.

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl + Enter` (or `Cmd + Enter`) | Translate |
| `Escape` (while input focused) | Clear input |

---

## Submission

Push all four files to a public GitHub repository and submit the URL.
