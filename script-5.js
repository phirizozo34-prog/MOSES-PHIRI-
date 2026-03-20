/* 
SECTIONS:
   1.  Constants & Configuration
   2.  DOM Element References
   3.  Application State
   4.  Character Counter
   5.  Debounce (real-time translation)
   6.  Translation API — Core Function
   7.  Loading State Manager
   8.  Output Renderer
   9.  Translate Button
   10. Swap / Switch Languages
   11. Language Change Listeners
   12. Text-to-Speech (TTS)
   13. Copy to Clipboard
   14. Toast Notifications
   15. Dark / Light Theme Toggle
   16. Translation History
   17. Clear Input Button
   18. Keyboard Shortcuts
   19. Page Load Initialisation
*/


/* 
   1. CONSTANTS & CONFIGURATION
 */

/** MyMemory public translation API endpoint */
const API_URL = 'https://api.mymemory.translated.net/get';

/** Maximum characters allowed in input */
const MAX_CHARS = 500;

/** Debounce delay in milliseconds (fires after user stops typing) */
const DEBOUNCE_DELAY = 750;

/** Toast display duration in milliseconds */
const TOAST_DURATION = 2500;

/** Maximum history items to remember */
const MAX_HISTORY = 5;

/**
 * Maps ISO 639-1 language codes to BCP-47 locale strings
 * used by the Web Speech API (SpeechSynthesis).
 */
const LANG_LOCALE_MAP = {
  en: 'en-US',
  fr: 'fr-FR',
  es: 'es-ES',
  de: 'de-DE',
  it: 'it-IT',
  pt: 'pt-PT',
  ru: 'ru-RU',
  zh: 'zh-CN',
  ja: 'ja-JP',
  ar: 'ar-SA',
  ko: 'ko-KR',
  nl: 'nl-NL',
  sv: 'sv-SE',
  pl: 'pl-PL',
  tr: 'tr-TR',
  hi: 'hi-IN',
  vi: 'vi-VN',
  th: 'th-TH',
};

/**
 * Maps language codes to full display names
 * (used in history chips and detected-language badge)
 */
const LANG_NAMES = {
  auto: 'Auto-detect',
  en: 'English', fr: 'French',   es: 'Spanish',    de: 'German',
  it: 'Italian', pt: 'Portuguese', ru: 'Russian',  zh: 'Chinese',
  ja: 'Japanese', ar: 'Arabic',  ko: 'Korean',     nl: 'Dutch',
  sv: 'Swedish', pl: 'Polish',   tr: 'Turkish',    hi: 'Hindi',
  vi: 'Vietnamese', th: 'Thai',
};


/* 
   2. DOM ELEMENT REFERENCES
 */
const $ = id => document.getElementById(id);

const DOM = {
  inputText:      $('inputText'),
  outputText:     $('outputText'),
  sourceLang:     $('sourceLang'),
  targetLang:     $('targetLang'),
  translateBtn:   $('translateBtn'),
  swapBtn:        $('swapBtn'),
  charCount:      $('charCount'),
  clearBtn:       $('clearBtn'),
  listenInputBtn: $('listenInputBtn'),
  listenOutputBtn:$('listenOutputBtn'),
  copyInputBtn:   $('copyInputBtn'),
  copyOutputBtn:  $('copyOutputBtn'),
  skeleton:       $('skeleton'),
  toast:          $('toast'),
  themeBtn:       $('themeBtn'),
  outputStatus:   $('outputStatus'),
  detectedBadge:  $('detectedBadge'),
  detectedLang:   $('detectedLang'),
  historyStrip:   $('historyStrip'),
  historyItems:   $('historyItems'),
};


/* 
   3. APPLICATION STATE
 */
const state = {
  /** The last successfully translated text (for cache deduplication) */
  lastInput:      '',
  lastSourceLang: '',
  lastTargetLang: '',

  /** Whether a translation request is in progress */
  isLoading: false,

  /** The current translation result string */
  currentOutput: '',

  /** Translation history array [{input, output, src, tgt}] */
  history: [],

  /** Active speech utterance (for cancellation) */
  activeUtterance: null,

  /** Debounce timer handle */
  debounceTimer: null,

  /** Toast dismiss timer handle */
  toastTimer: null,
};


/* 
   4. CHARACTER COUNTER
   Live counter displayed as "N / 500" in the input panel footer.
   Colour-coded: default grey → yellow (>450) → red (=500)
 */
function updateCharCounter() {
  const len = DOM.inputText.value.length;
  DOM.charCount.textContent = `${len} / ${MAX_CHARS}`;

  DOM.charCount.classList.remove('char-counter--warn', 'char-counter--over');
  if      (len >= MAX_CHARS) DOM.charCount.classList.add('char-counter--over');
  else if (len > 450)        DOM.charCount.classList.add('char-counter--warn');

  // Show/hide the clear button
  if (len > 0) {
    DOM.clearBtn.hidden = false;
    DOM.clearBtn.classList.add('visible');
  } else {
    DOM.clearBtn.classList.remove('visible');
    setTimeout(() => { DOM.clearBtn.hidden = true; }, 150);
  }
}


/* 
   5. DEBOUNCE — REAL-TIME TRANSLATION
   Waits DEBOUNCE_DELAY ms after the user stops typing before
   calling translate(). Prevents hammering the API on every key.
 */
function scheduleDebounce() {
  clearTimeout(state.debounceTimer);
  state.debounceTimer = setTimeout(() => {
    const text = DOM.inputText.value.trim();
    if (text) translate();
    else      clearOutput();
  }, DEBOUNCE_DELAY);
}

/** Attach debounce + counter to input events */
DOM.inputText.addEventListener('input', () => {
  updateCharCounter();
  scheduleDebounce();
});


/* 
   6. TRANSLATION API — CORE FUNCTION
   Fetches translation from MyMemory API using a GET request.
   Handles: empty input, API errors, HTTP errors, network errors.
 */
async function translate() {
  const inputValue = DOM.inputText.value.trim();

  // Guard: nothing to translate
  if (!inputValue) { clearOutput(); return; }

  // Guard: nothing changed since last successful translation
  if (
    inputValue === state.lastInput &&
    DOM.sourceLang.value === state.lastSourceLang &&
    DOM.targetLang.value === state.lastTargetLang
  ) return;

  // Set loading state
  setLoading(true);

  // Build API language pair
  const srcCode  = DOM.sourceLang.value === 'auto' ? 'autodetect' : DOM.sourceLang.value;
  const tgtCode  = DOM.targetLang.value;
  const langpair = `${srcCode}|${tgtCode}`;

  try {
    // ── Fetch translation 
    const url = `${API_URL}?q=${encodeURIComponent(inputValue)}&langpair=${encodeURIComponent(langpair)}`;
    const res = await fetch(url);

    // Check for HTTP-level errors
    if (!res.ok) throw new Error(`Network error: HTTP ${res.status}`);

    const data = await res.json();

    // Check for API-level errors (responseStatus !== 200)
    const status = Number(data.responseStatus);
    if (status !== 200) {
      throw new Error(data.responseDetails || `API error: status ${data.responseStatus}`);
    }

    // ── Success 
    const translated = data.responseData.translatedText;

    // Update state cache
    state.lastInput      = inputValue;
    state.lastSourceLang = DOM.sourceLang.value;
    state.lastTargetLang = DOM.targetLang.value;
    state.currentOutput  = translated;

    // Handle auto-detect: show which language was detected
    if (DOM.sourceLang.value === 'auto' && data.responseData.detectedLanguage) {
      const detected = data.responseData.detectedLanguage;
      showDetectedLanguage(detected);
    } else {
      hideDetectedLanguage();
    }

    // Render output
    renderOutput(translated, 'result');

    // Add to history
    addToHistory(inputValue, translated, DOM.sourceLang.value, tgtCode);

  } catch (err) {
    // ── Error handling 
    console.error('[LinguaFlow] Translation error:', err);
    renderOutput(`⚠ ${err.message}`, 'error');
    showToast(err.message, 'error');

  } finally {
    setLoading(false);
  }
}


/* 
   7. LOADING STATE MANAGER
   Controls: button spinner, skeleton shimmer, disabled states.
 */
function setLoading(isOn) {
  state.isLoading = isOn;
  DOM.translateBtn.disabled = isOn;

  if (isOn) {
    DOM.translateBtn.classList.add('is-loading');
    DOM.outputText.hidden = true;
    DOM.skeleton.hidden   = false;
    setOutputStatus('');
  } else {
    DOM.translateBtn.classList.remove('is-loading');
    DOM.skeleton.hidden   = true;
    DOM.outputText.hidden = false;
  }
}


/* 
   8. OUTPUT RENDERER
   Renders text into the output panel with appropriate class/state.
 */
function renderOutput(text, type = 'result') {
  DOM.outputText.textContent = text;
  DOM.outputText.className   = 'panel__output';

  switch (type) {
    case 'result':
      DOM.outputText.classList.add('panel__output--result');
      setOutputStatus('active');
      break;
    case 'error':
      DOM.outputText.classList.add('panel__output--error');
      setOutputStatus('error');
      break;
    case 'empty':
      DOM.outputText.classList.add('panel__output--empty');
      setOutputStatus('');
      break;
  }
}

function clearOutput() {
  state.currentOutput  = '';
  state.lastInput      = '';
  state.lastSourceLang = '';
  state.lastTargetLang = '';
  renderOutput('Translation will appear here…', 'empty');
  hideDetectedLanguage();
}

function setOutputStatus(type) {
  DOM.outputStatus.className = 'output-status';
  if (type) DOM.outputStatus.classList.add(`output-status--${type}`);
}

function showDetectedLanguage(langCode) {
  const name = LANG_NAMES[langCode] || langCode.toUpperCase();
  DOM.detectedLang.textContent = name;
  DOM.detectedBadge.hidden = false;
}

function hideDetectedLanguage() {
  DOM.detectedBadge.hidden = true;
}


/* 
   9. TRANSLATE BUTTON — Click handler
   Resets cache (forces a fresh API call even if text unchanged).
 */
DOM.translateBtn.addEventListener('click', () => {
  // Force fresh translation
  state.lastInput = '';
  translate();
});


/* 
   10. SWAP / SWITCH LANGUAGES
   Swaps source ↔ target selectors.
   Moves current output text back into input, then re-translates.
 */
DOM.swapBtn.addEventListener('click', () => {
  const srcVal    = DOM.sourceLang.value;
  const tgtVal    = DOM.targetLang.value;
  const curOutput = state.currentOutput.trim();

  // Swap the selectors
  // "auto" cannot be a target language — fall back to 'en'
  if (srcVal !== 'auto') {
    DOM.sourceLang.value = tgtVal;
    DOM.targetLang.value = srcVal;
  } else {
    DOM.sourceLang.value = tgtVal;
    DOM.targetLang.value = 'en';
  }

  // Swap text: put translated output back into input
  if (curOutput && !curOutput.startsWith('⚠')) {
    DOM.inputText.value = curOutput;
    updateCharCounter();
    clearTimeout(state.debounceTimer);
    state.lastInput = '';        // force fresh translation
    hideDetectedLanguage();
    translate();
  }

  showToast('Languages swapped', 'info');
});


/* 
   11. LANGUAGE CHANGE LISTENERS
   Re-translate immediately when the user changes either dropdown.
 */
DOM.sourceLang.addEventListener('change', () => {
  state.lastInput = '';
  hideDetectedLanguage();
  if (DOM.inputText.value.trim()) translate();
});

DOM.targetLang.addEventListener('change', () => {
  state.lastInput = '';
  if (DOM.inputText.value.trim()) translate();
});


/* 
   12. TEXT-TO-SPEECH (TTS)
   Uses the browser's built-in Web Speech API (SpeechSynthesis).
   Maps language codes → BCP-47 locale strings for correct voice.
 */
function speak(text, langCode, btn) {
  if (!text || text.startsWith('⚠')) return;

  // Check TTS support
  if (!('speechSynthesis' in window)) {
    showToast('Text-to-speech is not supported in this browser', 'error');
    return;
  }

  // If already speaking this same button, cancel (toggle behaviour)
  if (state.activeUtterance && btn.classList.contains('active')) {
    window.speechSynthesis.cancel();
    btn.classList.remove('active');
    state.activeUtterance = null;
    return;
  }

  // Cancel any previous speech
  window.speechSynthesis.cancel();

  const utterance  = new SpeechSynthesisUtterance(text);
  utterance.lang   = LANG_LOCALE_MAP[langCode] || 'en-US';
  utterance.rate   = 0.95;
  utterance.pitch  = 1;

  // Mark button as active while speaking
  btn.classList.add('active');
  state.activeUtterance = utterance;

  utterance.onend = () => {
    btn.classList.remove('active');
    state.activeUtterance = null;
  };
  utterance.onerror = (e) => {
    btn.classList.remove('active');
    state.activeUtterance = null;
    if (e.error !== 'interrupted') {
      showToast('Speech failed — try again', 'error');
    }
  };

  window.speechSynthesis.speak(utterance);
}

/** Listen to original input text */
DOM.listenInputBtn.addEventListener('click', () => {
  const text = DOM.inputText.value.trim();
  const lang = DOM.sourceLang.value === 'auto' ? 'en' : DOM.sourceLang.value;
  speak(text, lang, DOM.listenInputBtn);
});

/** Listen to translated output text */
DOM.listenOutputBtn.addEventListener('click', () => {
  const text = state.currentOutput.trim();
  speak(text, DOM.targetLang.value, DOM.listenOutputBtn);
});


/* 
   13. COPY TO CLIPBOARD
   Uses the Clipboard API. Falls back to execCommand for older browsers.
   Gives 1.8s visual confirmation on the button.
 */
async function copyToClipboard(text, btn) {
  if (!text || text.startsWith('⚠') || text === 'Translation will appear here…') return;

  try {
    // Modern Clipboard API
    await navigator.clipboard.writeText(text);
  } catch {
    // Fallback for browsers without clipboard API
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }

  // Visual confirmation: change icon + label, then restore
  const originalHTML = btn.innerHTML;
  btn.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
    <span>Copied!</span>
  `;
  btn.classList.add('success');

  setTimeout(() => {
    btn.innerHTML = originalHTML;
    btn.classList.remove('success');
  }, 1800);

  showToast('Copied to clipboard ✓');
}

DOM.copyInputBtn.addEventListener('click', () => {
  copyToClipboard(DOM.inputText.value.trim(), DOM.copyInputBtn);
});

DOM.copyOutputBtn.addEventListener('click', () => {
  copyToClipboard(state.currentOutput.trim(), DOM.copyOutputBtn);
});


/* 
   14. TOAST NOTIFICATIONS
   Lightweight pop-up at the bottom of the screen.
   Types: default (success/green) | error (red) | info (blue)
 */
function showToast(message, type = 'success') {
  clearTimeout(state.toastTimer);

  DOM.toast.textContent = message;
  DOM.toast.className   = `toast toast--visible`;
  if (type === 'error') DOM.toast.classList.add('toast--error');
  if (type === 'info')  DOM.toast.classList.add('toast--info');

  state.toastTimer = setTimeout(() => {
    DOM.toast.classList.remove('toast--visible');
  }, TOAST_DURATION);
}


/* 
   15. DARK / LIGHT THEME TOGGLE
   Toggles .light class on <body>.
   Persists preference to localStorage.
 */
function applyTheme(theme) {
  if (theme === 'light') {
    document.body.classList.add('light');
  } else {
    document.body.classList.remove('light');
  }
}

DOM.themeBtn.addEventListener('click', () => {
  const isLight = document.body.classList.toggle('light');
  localStorage.setItem('lf-theme', isLight ? 'light' : 'dark');
});

// Restore saved theme on page load
const savedTheme = localStorage.getItem('lf-theme');
if (savedTheme) applyTheme(savedTheme);


/* 
   16. TRANSLATION HISTORY
   Stores the last MAX_HISTORY translations in memory.
   Renders clickable chips in the history strip below the card.
 */
function addToHistory(input, output, src, tgt) {
  // Avoid duplicates (same input + same language pair)
  const isDuplicate = state.history.some(
    h => h.input === input && h.src === src && h.tgt === tgt
  );
  if (isDuplicate) return;

  // Prepend new entry and trim to limit
  state.history.unshift({ input, output, src, tgt });
  if (state.history.length > MAX_HISTORY) {
    state.history.pop();
  }

  renderHistory();
}

function renderHistory() {
  if (state.history.length === 0) {
    DOM.historyStrip.hidden = true;
    return;
  }

  DOM.historyStrip.hidden = false;
  DOM.historyItems.innerHTML = '';

  state.history.forEach(({ input, src, tgt }) => {
    const chip = document.createElement('button');
    chip.className  = 'history-chip';
    chip.title      = `${input} (${LANG_NAMES[src] || src} → ${LANG_NAMES[tgt] || tgt})`;
    chip.innerHTML  = `
      <span class="history-chip__pair">${src === 'auto' ? '?' : src}→${tgt}</span>
      ${truncate(input, 28)}
    `;

    chip.addEventListener('click', () => {
      // Restore this translation into the app
      DOM.inputText.value    = input;
      if (src !== 'auto') DOM.sourceLang.value = src;
      DOM.targetLang.value   = tgt;
      updateCharCounter();
      state.lastInput = '';
      translate();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    DOM.historyItems.appendChild(chip);
  });
}

function truncate(str, len) {
  return str.length > len ? str.slice(0, len) + '…' : str;
}


/* 
   17. CLEAR INPUT BUTTON
   Clears textarea, output, resets state.
 */
DOM.clearBtn.addEventListener('click', () => {
  DOM.inputText.value = '';
  updateCharCounter();
  clearOutput();
  clearTimeout(state.debounceTimer);
  window.speechSynthesis?.cancel();
  DOM.inputText.focus();
});


/* 
   18. KEYBOARD SHORTCUTS
   Ctrl/Cmd + Enter  →  Translate
   Escape            →  Clear input (when focused)
 */
document.addEventListener('keydown', (e) => {
  // Ctrl+Enter or Cmd+Enter → Translate
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    state.lastInput = '';
    translate();
    showToast('Translating… (Ctrl+Enter)', 'info');
  }

  // Escape → clear if textarea is focused
  if (e.key === 'Escape' && document.activeElement === DOM.inputText) {
    DOM.clearBtn.click();
  }
});


/* 
   19. PAGE LOAD INITIALISATION
   Sets initial character count, then fires the default
   English → French translation of "Hello, how are you".
 */
function init() {
  // Set up initial char counter
  updateCharCounter();

  // Render initial output placeholder
  renderOutput('Bonjour, comment allez-vous', 'result');
  state.currentOutput  = 'Bonjour, comment allez-vous';
  state.lastInput      = 'Hello, how are you';
  state.lastSourceLang = 'en';
  state.lastTargetLang = 'fr';

  // Trigger auto-translate on first load (fetches fresh from API)
  // Small delay so page animations settle first
  setTimeout(() => translate(), 400);
}

// Wait for the DOM to be fully ready before initialising
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
