import { TRANSLATIONS, VIDEO_CHAPTERS, RECIPES, resolveLang, getCopy } from './landing-i18n.mjs';

const STORAGE_KEY = 'project-docs-landing-lang';

function getInitialLang() {
  try {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get('lang');
    if (fromUrl) return resolveLang(fromUrl);
  } catch {
    // ignore URL errors
  }

  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) return resolveLang(saved);
  } catch {
    // ignore storage errors
  }

  return 'pt';
}

let currentLang = getInitialLang();
let currentRecipe = 'cli';

const langButtons = Array.from(document.querySelectorAll('[data-lang-btn]'));
const i18nNodes = Array.from(document.querySelectorAll('[data-i18n]'));
const i18nAriaNodes = Array.from(document.querySelectorAll('[data-i18n-aria]'));
const video = document.getElementById('demo-video');
const videoToggleBtn = document.getElementById('video-toggle-btn');
const videoReplayBtn = document.getElementById('video-replay-btn');
const chapterButtons = Array.from(document.querySelectorAll('[data-chapter]'));
const recipeTablist = document.querySelector('.recipe-tabs[role="tablist"]');
const recipeTabs = Array.from(document.querySelectorAll('[data-recipe]'));
const recipePanel = document.getElementById('panel-recipe');
const recipeCodeEl = document.getElementById('recipe-code');
const copyBtn = document.getElementById('copy-recipe-btn');

function updateVideoToggleLabel() {
  if (!videoToggleBtn || !video) return;
  const copy = getCopy(currentLang);
  videoToggleBtn.textContent = video.paused ? copy.videoPlay : copy.videoPause;
}

function applyLanguage(lang, { persist = true } = {}) {
  currentLang = resolveLang(lang);
  const copy = getCopy(currentLang);

  document.documentElement.lang = currentLang === 'en' ? 'en' : 'pt';
  document.title = copy.metaTitle;

  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) metaDesc.setAttribute('content', copy.metaDescription);
  const ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle) ogTitle.setAttribute('content', copy.metaTitle);
  const ogDesc = document.querySelector('meta[property="og:description"]');
  if (ogDesc) ogDesc.setAttribute('content', copy.metaDescription);

  for (const el of i18nNodes) {
    const key = el.getAttribute('data-i18n');
    if (key && key in copy) {
      el.textContent = copy[key];
    }
  }

  for (const el of i18nAriaNodes) {
    const key = el.getAttribute('data-i18n-aria');
    if (key && key in copy) {
      el.setAttribute('aria-label', copy[key]);
    }
  }

  for (const btn of langButtons) {
    const active = btn.getAttribute('data-lang-btn') === currentLang;
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  }

  updateVideoToggleLabel();

  if (copyBtn && copyBtn.dataset.copied !== 'true') {
    copyBtn.textContent = copy.copyBtn;
  }

  if (persist) {
    try {
      window.localStorage.setItem(STORAGE_KEY, currentLang);
    } catch {
      // ignore storage errors
    }
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('lang', currentLang);
      window.history.replaceState({}, '', url.toString());
    } catch {
      // ignore history errors
    }
  }
}

function syncActiveChapter(timeSeconds) {
  let activeId = VIDEO_CHAPTERS[0].id;
  for (const chap of VIDEO_CHAPTERS) {
    if (timeSeconds >= chap.time - 0.35) {
      activeId = chap.id;
    }
  }
  for (const btn of chapterButtons) {
    const isActive = btn.getAttribute('data-chapter') === activeId;
    btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  }
}

function selectRecipe(recipeId, { focusTab = false } = {}) {
  if (!(recipeId in RECIPES)) return;
  currentRecipe = recipeId;
  if (recipeCodeEl) {
    recipeCodeEl.textContent = RECIPES[recipeId];
  }
  for (const tab of recipeTabs) {
    const active = tab.getAttribute('data-recipe') === recipeId;
    tab.setAttribute('aria-selected', active ? 'true' : 'false');
    tab.setAttribute('tabindex', active ? '0' : '-1');
    if (active) {
      if (recipePanel && tab.id) {
        recipePanel.setAttribute('aria-labelledby', tab.id);
      }
      if (focusTab) tab.focus();
    }
  }
}

for (const btn of langButtons) {
  btn.addEventListener('click', () => {
    const nextLang = btn.getAttribute('data-lang-btn');
    if (nextLang) applyLanguage(nextLang, { persist: true });
  });
}

if (video) {
  video.addEventListener('play', updateVideoToggleLabel);
  video.addEventListener('pause', updateVideoToggleLabel);
  video.addEventListener('timeupdate', () => {
    syncActiveChapter(video.currentTime);
  });
}

if (videoToggleBtn && video) {
  videoToggleBtn.addEventListener('click', () => {
    if (video.paused) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  });
}

if (videoReplayBtn && video) {
  videoReplayBtn.addEventListener('click', () => {
    video.currentTime = 0;
    video.play().catch(() => {});
    syncActiveChapter(0);
  });
}

for (const btn of chapterButtons) {
  btn.addEventListener('click', () => {
    const chapId = btn.getAttribute('data-chapter');
    const target = VIDEO_CHAPTERS.find((c) => c.id === chapId);
    if (!target || !video) return;
    video.currentTime = target.time;
    syncActiveChapter(target.time);
    video.play().catch(() => {});
  });
}

for (const tab of recipeTabs) {
  tab.addEventListener('click', () => {
    const id = tab.getAttribute('data-recipe');
    if (id) selectRecipe(id);
  });
}

if (recipeTablist && recipeTabs.length) {
  recipeTablist.addEventListener('keydown', (e) => {
    const idx = recipeTabs.indexOf(document.activeElement);
    if (idx === -1) return;
    let nextIdx = null;
    if (e.key === 'ArrowRight') nextIdx = (idx + 1) % recipeTabs.length;
    else if (e.key === 'ArrowLeft') nextIdx = (idx - 1 + recipeTabs.length) % recipeTabs.length;
    else if (e.key === 'Home') nextIdx = 0;
    else if (e.key === 'End') nextIdx = recipeTabs.length - 1;
    if (nextIdx !== null) {
      e.preventDefault();
      const id = recipeTabs[nextIdx]?.getAttribute('data-recipe');
      if (id) selectRecipe(id, { focusTab: true });
    }
  });
}

let copyTimer = null;
if (copyBtn) {
  copyBtn.addEventListener('click', async () => {
    const text = RECIPES[currentRecipe] || '';
    const copy = getCopy(currentLang);
    let ok = false;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        ok = true;
      } catch {
        ok = false;
      }
    }

    if (!ok && recipeCodeEl) {
      try {
        const range = document.createRange();
        range.selectNodeContents(recipeCodeEl);
        const sel = window.getSelection();
        if (sel) {
          sel.removeAllRanges();
          sel.addRange(range);
        }
        ok = document.execCommand('copy');
        if (sel) sel.removeAllRanges();
      } catch {
        ok = false;
      }
    }

    if (copyTimer) clearTimeout(copyTimer);
    copyBtn.dataset.copied = ok ? 'true' : 'false';
    copyBtn.textContent = ok ? copy.copiedBtn : copy.copyFailedBtn;
    copyTimer = setTimeout(() => {
      copyBtn.dataset.copied = 'false';
      copyBtn.textContent = getCopy(currentLang).copyBtn;
    }, 1800);
  });
}

selectRecipe('cli');
applyLanguage(currentLang, { persist: false });
syncActiveChapter(0);
