// Language picker: swaps the page's English phrases for the ones in i18n/strings.js.
// Load after strings.js and before script.js, which uses t() for messages it builds itself.

const LANGS = {
  en: { name: "English", english: "English", html: "en" },
  es: { name: "Español", english: "Spanish", html: "es" },
  pt: { name: "Português", english: "Portuguese", html: "pt" },
  pl: { name: "Polski", english: "Polish", html: "pl" },
  zh: { name: "中文", english: "Chinese", html: "zh-Hans" },
};
const ATTRS = ["placeholder", "aria-label", "alt", "title"];

let lang = (() => {
  const asked = new URLSearchParams(location.search).get("lang");
  if (LANGS[asked]) return asked;
  try { const saved = localStorage.getItem("lang"); if (LANGS[saved]) return saved; } catch {}
  return "en";
})();

// Translate one English phrase, keeping the spaces around it.
function t(text) {
  if (lang === "en" || !text) return text;
  const key = text.trim();
  const hit = window.I18N_STRINGS?.[lang]?.[key];
  if (!hit) return text;
  return text.slice(0, text.indexOf(key)) + hit + text.slice(text.indexOf(key) + key.length);
}

const original = new WeakMap();   // node or element -> its English text / attributes

function translateTree(root) {
  if (!root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => n.parentElement?.closest("script, style, textarea, [data-no-translate]") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
  });
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!original.has(n)) original.set(n, n.nodeValue);
    const next = t(original.get(n));
    if (n.nodeValue !== next) n.nodeValue = next;
  }
  const elements = root.nodeType === 1 ? [root, ...root.querySelectorAll("*")] : [];
  for (const el of elements) {
    for (const a of ATTRS) {
      if (!el.hasAttribute(a)) continue;
      const saved = original.get(el) || {};
      if (!(a in saved)) { saved[a] = el.getAttribute(a); original.set(el, saved); }
      el.setAttribute(a, t(saved[a]));
    }
  }
}

function applyLanguage() {
  document.documentElement.lang = LANGS[lang].html;
  document.documentElement.dataset.lang = lang;
  translateTree(document.body);
  document.querySelectorAll('input[name="language"]').forEach((i) => { i.value = LANGS[lang].english; });
  const select = document.getElementById("lang-select");
  if (select) select.value = lang;
  const note = document.getElementById("lang-note");
  if (note) note.hidden = lang === "en";
}

function addPicker() {
  const tools = document.querySelector(".header-tools");
  if (!tools || document.getElementById("lang-select")) return;
  const label = document.createElement("label");
  label.className = "lang-pick";
  label.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg><span class="sr">Language</span>';
  const select = document.createElement("select");
  select.id = "lang-select";
  select.setAttribute("data-no-translate", "");
  for (const [code, info] of Object.entries(LANGS)) {
    const o = document.createElement("option");
    o.value = code;
    o.textContent = info.name;
    o.lang = info.html;
    select.append(o);
  }
  select.addEventListener("change", () => {
    lang = select.value;
    try { localStorage.setItem("lang", lang); } catch {}
    applyLanguage();
  });
  label.append(select);
  tools.prepend(label);
}

// Pages that are only in English say so, in the visitor's language.
function addEnglishOnlyNote() {
  if (document.body.hasAttribute("data-translated") || document.body.classList.contains("admin")) return;
  const main = document.getElementById("main");
  if (!main) return;
  const note = document.createElement("div");
  note.id = "lang-note";
  note.className = "lang-note";
  note.innerHTML = '<div class="wrap"><p>This page is in English. For help in your language, use the form on our home page or call <a href="tel:18606045250">860.604.5250</a>.</p></div>';
  const hero = main.querySelector(".page-hero");
  if (hero) hero.after(note);
  else main.prepend(note);
}

addPicker();
addEnglishOnlyNote();

document.addEventListener("DOMContentLoaded", () => {
  applyLanguage();
  // Messages that appear later (form errors, thank-yous, notices) get translated as they arrive.
  new MutationObserver((changes) => {
    if (lang === "en") return;
    for (const c of changes) c.addedNodes.forEach((n) => (n.nodeType === 3 ? translateTree(n.parentElement) : translateTree(n)));
  }).observe(document.body, { childList: true, subtree: true });
});
