// Edit these values to change where requests go and what shows on the site.
const PROJECT = {
  inbox: "amabio124@gmail.com",   // every request and volunteer sign-up is emailed here
  backendUrl: "https://script.google.com/macros/s/AKfycbycSsVa9V2zSgfj6yauA8MgkERbKL_xtPoX_WCXGuLfGDMJfQxeMHKKMX6j-0fF1-0/exec",                 // the Google Apps Script web app address (see give-back-backend/SETUP.md); saves requests for the admin panel
  churchAddress: "",              // e.g. "123 Main Street, Rocky Hill, CT 06067"; left blank it stays hidden
  phone: "",                      // public phone number, e.g. "(860) 555-0123"; left blank it stays hidden
  siteUrl: "",                    // the public web address, used on the printed flyer's QR code; blank = this page's address

  // Tech Help Days and other gatherings. Past dates hide themselves; with none left, the section stays hidden.
  // Example: { date: "2026-11-14", title: "Tech Help Day", time: "10 am – 1 pm", place: "Church fellowship hall" },
  events: [],
};

// Requests go to the backend first (saved to the team's Google Sheet and emailed). If it isn't set up
// or doesn't answer, they go straight to the inbox through FormSubmit instead, so nothing is lost.
// FormSubmit forwards each submission to the inbox. After the first one, it emails the inbox
// an activation link; after activating, you can swap the address here for the random alias
// FormSubmit gives you so the email address isn't visible in the page source.
const ENDPOINT = "https://formsubmit.co/ajax/" + PROJECT.inbox;

const $ = (id) => document.getElementById(id);

const store = {
  get(key) { try { return localStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { localStorage.setItem(key, value); } catch {} },
  remove(key) { try { localStorage.removeItem(key); } catch {} },
};

/* Contact details */

const phoneLink = () => {
  const link = document.createElement("a");
  link.href = "tel:" + PROJECT.phone.replace(/[^\d+]/g, "");
  link.textContent = PROJECT.phone;
  return link;
};

const emailLink = () => {
  const link = document.createElement("a");
  link.href = "mailto:" + PROJECT.inbox;
  link.textContent = PROJECT.inbox;
  return link;
};

if ($("footer-contact")) {
  $("footer-contact").replaceChildren("Email ", emailLink());
  if (PROJECT.phone) $("footer-contact").append(document.createElement("br"), "Call ", phoneLink());
}

if ($("ask-email")) {
  $("ask-email").append("Rather write to us yourself? Email ", emailLink(), PROJECT.phone ? " or call " : "", PROJECT.phone ? phoneLink() : "", ".");
  $("ask-email").hidden = false;
}

document.querySelectorAll("[data-inbox]").forEach((el) => { el.textContent = PROJECT.inbox; });
document.querySelectorAll("[data-phone]").forEach((el) => {
  if (PROJECT.phone) el.textContent = PROJECT.phone;
  else el.closest("[data-phone-row]")?.remove();
});

if ($("year")) $("year").textContent = new Date().getFullYear();

document.querySelectorAll("[data-church-address]").forEach((el) => {
  if (PROJECT.churchAddress) el.textContent = PROJECT.churchAddress;
  else el.closest("[data-address-row]")?.remove();
});

/* Menu (small screens) */

const menuButton = document.querySelector(".menu-btn");
const nav = $("site-nav");
if (menuButton && nav) {
  const close = () => { nav.classList.remove("open"); menuButton.setAttribute("aria-expanded", "false"); menuButton.textContent = "Menu"; };
  menuButton.addEventListener("click", () => {
    const open = !nav.classList.contains("open");
    nav.classList.toggle("open", open);
    menuButton.setAttribute("aria-expanded", String(open));
    menuButton.textContent = open ? "Close" : "Menu";
  });
  nav.addEventListener("click", (event) => { if (event.target.closest("a")) close(); });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") close(); });

  const here = location.pathname.split("/").pop() || "index.html";
  nav.querySelectorAll("a").forEach((a) => {
    if (a.getAttribute("href") === here) a.setAttribute("aria-current", "page");
  });
}

/* Text size */

const sizeButtons = document.querySelectorAll(".textsize button");
const setSize = (size) => {
  document.documentElement.dataset.size = size;
  sizeButtons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.size === size)));
  store.set("textSize", size);
};
setSize(store.get("textSize") || "1");
sizeButtons.forEach((b) => b.addEventListener("click", () => setSize(b.dataset.size)));

/* Seasonal notice: shown automatically during these dates each year, until dismissed. */

const NOTICES = [
  {
    id: "medicare-open-enrollment",
    from: [10, 15], to: [12, 7],   // [month, day]
    html: '<strong>Medicare Open Enrollment runs Oct 15 – Dec 7.</strong> Get free, unbiased help from CHOICES at <a href="tel:18009949422">1-800-994-9422</a>. Never give your Medicare number to someone who calls you.',
  },
  {
    id: "winter-heating",
    from: [12, 8], to: [3, 15],
    html: '<strong>Staying warm this winter?</strong> For help with heating bills in Connecticut, dial <a href="tel:211">211</a>. If you lose heat and feel unsafe, call 911.',
  },
];

if ($("notice")) {
  const now = new Date();
  const today = (now.getMonth() + 1) * 100 + now.getDate();
  const active = NOTICES.find((n) => {
    const from = n.from[0] * 100 + n.from[1];
    const to = n.to[0] * 100 + n.to[1];
    const inRange = from <= to ? today >= from && today <= to : today >= from || today <= to;
    return inRange && store.get("notice:" + n.id + ":" + now.getFullYear()) !== "closed";
  });
  if (active) {
    $("notice-text").innerHTML = active.html;
    $("notice").hidden = false;
    $("notice-close").addEventListener("click", () => {
      $("notice").hidden = true;
      store.set("notice:" + active.id + ":" + now.getFullYear(), "closed");
    });
  }
}

/* Events */

if ($("events")) {
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
  const upcoming = PROJECT.events
    .map((e) => ({ ...e, when: new Date(e.date + "T12:00:00") }))
    .filter((e) => e.when >= startOfToday)
    .sort((a, b) => a.when - b.when);
  for (const e of upcoming) {
    const item = document.createElement("article");
    item.className = "event";
    const date = document.createElement("div");
    date.className = "event-date";
    const month = document.createElement("span");
    month.textContent = e.when.toLocaleDateString("en-US", { month: "short" });
    const day = document.createElement("b");
    day.textContent = e.when.getDate();
    const weekday = document.createElement("span");
    weekday.textContent = e.when.toLocaleDateString("en-US", { weekday: "short" });
    date.append(month, day, weekday);
    const body = document.createElement("div");
    const title = document.createElement("h3");
    title.textContent = e.title;
    const info = document.createElement("p");
    info.textContent = [e.time, e.place].filter(Boolean).join(" · ");
    body.append(title, info);
    item.append(date, body);
    $("event-list").append(item);
  }
  $("events").hidden = upcoming.length === 0;
}

/* Forms */

const LABELS = {
  name: "Name", phone: "Phone", email: "Email", town: "Town", for: "Help is for",
  kind: "Kind of help", details: "Details", contact: "Best way to reach", when: "Best time",
  callback: "Would like a call", private: "Keep private",
};

const reference = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `GB-${pad(d.getMonth() + 1)}${pad(d.getDate())}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
};

const labelText = (form, el) => {
  const label = el.id ? form.querySelector(`label[for="${el.id}"]`) : el.closest("fieldset")?.querySelector("legend");
  return label.firstChild.textContent.trim().replace(/\?$/, "");
};

const firstProblem = (form) => {
  for (const el of form.querySelectorAll("[required]")) {
    if (!el.value.trim()) return { el, message: `Please fill in: ${labelText(form, el)}.` };
  }
  for (const group of form.querySelectorAll("[data-required]")) {
    if (!form.querySelector(`input[name="${group.dataset.required}"]:checked`)) {
      return { el: group.querySelector("input"), message: `Please choose: ${labelText(form, group)}.` };
    }
  }
  const email = form.querySelector('input[type="email"]');
  if (email && email.value.trim() && !email.checkValidity()) return { el: email, message: "Please check your email address, or leave it blank." };
  const phone = form.querySelector('input[type="tel"]');
  if (phone && (phone.required || phone.value.trim()) && phone.value.replace(/\D/g, "").length < 7) {
    return { el: phone, message: "Please check the phone number." };
  }
  return null;
};

// Keeps what someone has typed if they close the page by accident (only on their own device).
const draft = (form) => {
  const key = "draft:" + form.id;
  const fields = () => [...form.elements].filter((el) => el.name && el.name !== "_honey");
  const saved = JSON.parse(store.get(key) || "null");
  if (saved) {
    for (const el of fields()) {
      if (!(el.name in saved)) continue;
      if (el.type === "radio") el.checked = saved[el.name] === el.value;
      else el.value = saved[el.name];
    }
    const note = form.querySelector(".draft-note");
    if (note) note.hidden = false;
  }
  form.addEventListener("input", () => {
    const data = {};
    for (const el of fields()) {
      if (el.type === "radio") { if (el.checked) data[el.name] = el.value; }
      else data[el.name] = el.value;
    }
    store.set(key, JSON.stringify(data));
  });
  return () => store.remove(key);
};

const postJson = async (url, body, headers) => {
  const response = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(response.status);
  return result;
};

const send = async (type, ref, fields, subject) => {
  if (PROJECT.backendUrl) {
    try {
      // text/plain keeps this a "simple" request, which Google Apps Script accepts from any site.
      const result = await postJson(PROJECT.backendUrl, { action: "submit", type, ref, ...fields }, { "Content-Type": "text/plain;charset=utf-8" });
      if (result.ok) return;
      throw new Error(result.error);
    } catch (error) {
      console.warn("Backend didn't take it, emailing instead:", error);
    }
  }
  const payload = { Reference: ref, Type: type };
  for (const [key, value] of Object.entries(fields)) payload[LABELS[key] || key] = value;
  payload._subject = subject;
  payload._template = "table";
  payload._captcha = "false";
  if (fields.email) payload._replyto = fields.email;
  const result = await postJson(ENDPOINT, payload, { "Content-Type": "application/json", Accept: "application/json" });
  if (String(result.success) !== "true") throw new Error(result.message || "not sent");
};

const setUp = (form) => {
  const panel = form.parentElement;
  const thanks = panel.querySelector(".thanks");
  const status = form.querySelector(".status");
  const button = form.querySelector('button[type="submit"]');
  const buttonText = button.textContent;
  const clearDraft = draft(form);

  const say = (content, isError) => {
    status.replaceChildren(...[].concat(content));
    status.classList.toggle("error", Boolean(isError));
  };

  const finish = (ref) => {
    clearDraft();
    panel.querySelector(".ref").textContent = ref;
    form.hidden = true;
    thanks.hidden = false;
    thanks.focus();
    thanks.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  form.querySelector(".draft-clear")?.addEventListener("click", () => {
    form.reset();
    clearDraft();
    form.querySelector(".draft-note").hidden = true;
  });

  form.addEventListener("input", (event) => {
    event.target.removeAttribute("aria-invalid");
    if (status.classList.contains("error")) say("");
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (button.disabled) return;

    form.querySelectorAll("[aria-invalid]").forEach((el) => el.removeAttribute("aria-invalid"));
    const problem = firstProblem(form);
    if (problem) {
      problem.el.setAttribute("aria-invalid", "true");
      problem.el.focus();
      say(problem.message, true);
      return;
    }

    const data = Object.fromEntries(new FormData(form));
    const ref = reference();
    if (data._honey) return finish(ref);   // hidden field only robots fill in
    delete data._honey;

    const fields = {};
    for (const [key, value] of Object.entries(data)) {
      if (String(value).trim()) fields[key] = String(value).trim();
    }
    const who = fields.name || "Someone";
    const subject = `${form.dataset.kind}: ${who}${fields.town ? " (" + fields.town + ")" : ""} · ${ref}`;

    button.disabled = true;
    button.textContent = "Sending…";
    say("");

    try {
      await send(form.dataset.kind, ref, fields, subject);
      finish(ref);
    } catch (error) {
      console.error("Form send failed:", error);
      const body = [`Reference: ${ref}`, `Type: ${form.dataset.kind}`]
        .concat(Object.entries(fields).map(([k, v]) => `${LABELS[k] || k}: ${v}`)).join("\n");
      const mail = document.createElement("a");
      mail.href = `mailto:${PROJECT.inbox}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      mail.textContent = "send it by email instead";
      say(["Sorry, that didn't go through. Please try again in a moment, or ", mail, PROJECT.phone ? ` or call ${PROJECT.phone}.` : "."], true);
    } finally {
      button.disabled = false;
      button.textContent = buttonText;
    }
  });

  thanks.querySelector("[data-again]")?.addEventListener("click", () => {
    form.reset();
    say("");
    thanks.hidden = true;
    form.hidden = false;
    form.querySelector("input").focus();
  });
};

document.querySelectorAll("form.form").forEach(setUp);

/* Print just one part of a page */

document.querySelectorAll("[data-print]").forEach((button) => {
  button.addEventListener("click", () => {
    const target = button.closest("[data-printable]") || $(button.dataset.print);
    if (!target) return window.print();
    document.body.classList.add("print-one");
    target.classList.add("printing");
    window.print();
  });
});
window.addEventListener("afterprint", () => {
  document.body.classList.remove("print-one");
  document.querySelectorAll(".printing").forEach((el) => el.classList.remove("printing"));
});

/* Read aloud (uses the device's built-in voice) */

const speech = window.speechSynthesis;
const readButtons = document.querySelectorAll("[data-read]");
if (!speech) readButtons.forEach((b) => b.remove());
else {
  let speaking = null;
  const stop = () => {
    speech.cancel();
    if (speaking) { speaking.setAttribute("aria-pressed", "false"); speaking.lastChild.textContent = " Read aloud"; }
    speaking = null;
  };
  readButtons.forEach((button) => {
    button.addEventListener("click", () => {
      if (speaking === button) return stop();
      stop();
      const source = button.closest("[data-printable]");
      const text = [...source.querySelectorAll("h2, h3, p, li")]
        .filter((el) => el.offsetParent !== null && !el.closest(".guide-tools, .checker"))
        .map((el) => el.textContent.trim())
        .join(". ");
      const say = new SpeechSynthesisUtterance(text);
      say.rate = 0.9;
      say.lang = "en-US";
      say.onend = stop;
      speaking = button;
      button.setAttribute("aria-pressed", "true");
      button.lastChild.textContent = " Stop reading";
      speech.speak(say);
    });
  });
  window.addEventListener("pagehide", () => speech.cancel());
}

/* Tech guides: iPhone / Android choice */

const deviceButtons = document.querySelectorAll("[data-pick-device]");
if (deviceButtons.length) {
  const pick = (device) => {
    deviceButtons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.pickDevice === device)));
    document.querySelectorAll("[data-device]").forEach((el) => { el.hidden = el.dataset.device !== device; });
    store.set("device", device);
  };
  pick(store.get("device") || (/android/i.test(navigator.userAgent) ? "android" : "iphone"));
  deviceButtons.forEach((b) => b.addEventListener("click", () => pick(b.dataset.pickDevice)));
}

/* Scam checker */

const checker = $("scam-checker");
if (checker) {
  const verdict = $("scam-verdict");
  const update = () => {
    const count = checker.querySelectorAll("input:checked").length;
    verdict.hidden = false;
    verdict.className = "verdict " + (count ? "danger" : "safe");
    verdict.replaceChildren();
    const head = document.createElement("strong");
    const body = document.createElement("span");
    if (count) {
      head.textContent = count === 1 ? "This has a warning sign of a scam." : `This has ${count} warning signs of a scam.`;
      body.textContent = "Stop. Don't pay, don't share any numbers or codes, and don't click any links. Hang up or close it, then call someone you trust, or the AARP Fraud Watch Helpline at 877-908-3360.";
    } else {
      head.textContent = "No warning signs checked.";
      body.textContent = "That's a good sign. But if something still feels wrong, trust that feeling and check with someone before you act.";
    }
    verdict.append(head, body);
  };
  checker.addEventListener("change", update);
  $("scam-reset")?.addEventListener("click", () => {
    checker.querySelectorAll("input").forEach((i) => { i.checked = false; });
    verdict.hidden = true;
  });
}

/* Printable flyer: QR code that opens the site */

const qrBox = $("flyer-qr");
if (qrBox) {
  const url = PROJECT.siteUrl || new URL("index.html", location.href).href.replace(/index\.html$/, "");
  document.querySelectorAll("[data-site-url]").forEach((el) => { el.textContent = url.replace(/^https?:\/\//, "").replace(/\/$/, ""); });
  if (window.QRCode) {
    new QRCode(qrBox, { text: url, width: 360, height: 360, colorDark: "#101a30", colorLight: "#ffffff", correctLevel: QRCode.CorrectLevel.M });
    qrBox.title = "";
  } else {
    qrBox.closest(".qr").hidden = true;
  }
}

/* Show a follow-up field only when the answer needs it (e.g. "Yes, please call me") */

document.querySelectorAll("form").forEach((form) => {
  const triggers = form.querySelectorAll("[data-reveal]");
  if (!triggers.length) return;
  const sync = () => triggers.forEach((t) => {
    const target = $(t.dataset.reveal);
    target.hidden = !t.checked;
    target.querySelector("input").required = t.checked;
  });
  form.addEventListener("change", sync);
  form.addEventListener("reset", () => setTimeout(sync));
  sync();
});
