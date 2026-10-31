// Team dashboard: reads and updates requests through the private backend (see give-back-backend/).
// The team password is checked by the backend, never here, so request details stay private.

const OPEN = ["New", "Contacted", "Scheduled", "In progress"];
const LATE_HOURS = 48;
const TYPE_TABS = [
  { id: "all", label: "Everything" },
  { id: "Help request", label: "Help requests" },
  { id: "Prayer request", label: "Prayer requests" },
  { id: "Volunteer sign-up", label: "Volunteers" },
];

const state = {
  token: null, name: "", demo: false,
  items: [], statuses: ["New", "Contacted", "Scheduled", "In progress", "Done", "Can't help", "Archived"],
  tab: "all", openRef: null, loadedAt: null,
};

const el = (tag, props = {}, ...children) => {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
    else if (v !== undefined && v !== null && v !== false) node.setAttribute(k, v === true ? "" : v);
  }
  node.append(...children.flat().filter((c) => c !== null && c !== undefined && c !== false));
  return node;
};

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-");
const hoursSince = (iso) => (Date.now() - new Date(iso).getTime()) / 36e5;
const isLate = (item) => item.status === "New" && hoursSince(item.created) > LATE_HOURS;
const ago = (iso) => {
  const h = hoursSince(iso);
  if (h < 1) return Math.max(1, Math.round(h * 60)) + " min ago";
  if (h < 24) return Math.round(h) + " hr ago";
  const d = Math.round(h / 24);
  return d === 1 ? "yesterday" : d + " days ago";
};
const fullDate = (iso) => new Date(iso).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const digits = (s) => String(s || "").replace(/[^\d+]/g, "");

let toastTimer;
const toast = (text) => {
  $("toast").textContent = text;
  $("toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $("toast").hidden = true; }, 2600);
};

/* Talking to the backend */

const api = async (action, extra = {}) => {
  if (state.demo) return demoApi(action, extra);
  if (!PROJECT.backendUrl) throw Object.assign(new Error("not_connected"), { code: "not_connected" });
  const result = await postJson(PROJECT.backendUrl, { action, token: state.token, ...extra }, { "Content-Type": "text/plain;charset=utf-8" });
  if (!result.ok) {
    if (result.error === "auth" && action !== "login") signOut("Your session ended. Please sign in again.");
    throw Object.assign(new Error(result.error || "failed"), { code: result.error });
  }
  return result;
};

/* Sign in / out */

const saveSession = () => {
  try { sessionStorage.setItem("team", JSON.stringify({ token: state.token, name: state.name })); } catch {}
};

const showDash = () => {
  $("login-view").hidden = true;
  $("dash-view").hidden = false;
  $("who").hidden = false;
  $("who").textContent = "Signed in as " + state.name;
  $("sign-out").hidden = false;
  $("demo-banner").hidden = !state.demo;
};

const signOut = (message) => {
  if (state.token && !state.demo) api("logout").catch(() => {});
  state.token = null;
  state.demo = false;
  state.items = [];
  try { sessionStorage.removeItem("team"); } catch {}
  closeDrawer();
  $("dash-view").hidden = true;
  $("login-view").hidden = false;
  $("who").hidden = true;
  $("sign-out").hidden = true;
  $("login-status").textContent = message || "";
  $("login-status").classList.toggle("error", Boolean(message));
  $("login-password").value = "";
};

$("login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const status = $("login-status");
  const name = $("login-name").value.trim();
  const password = $("login-password").value;
  status.classList.add("error");
  if (!name) { status.textContent = "Please enter your name."; return $("login-name").focus(); }
  if (!password) { status.textContent = "Please enter the team password."; return $("login-password").focus(); }
  if (!PROJECT.backendUrl) {
    status.textContent = "The dashboard isn't connected yet. Ask whoever runs the website to finish the Google setup. Meanwhile you can try it with sample requests below.";
    return;
  }
  status.classList.remove("error");
  status.textContent = "Signing in…";
  try {
    const result = await api("login", { name, password });
    state.token = result.token;
    state.name = result.name;
    if (result.statuses) state.statuses = result.statuses;
    try { localStorage.setItem("teamName", name); } catch {}
    saveSession();
    status.textContent = "";
    showDash();
    await load();
  } catch (error) {
    status.classList.add("error");
    status.textContent =
      error.code === "auth" ? "That password isn't right. Please try again." :
      error.code === "locked" ? "Too many wrong tries. Please wait 15 minutes and try again." :
      "Couldn't reach the server. Check your internet connection and try again.";
  }
});

$("sign-out").addEventListener("click", () => signOut());

/* Loading */

const load = async (quiet) => {
  try {
    const result = await api("list");
    state.items = result.items;
    if (result.statuses) state.statuses = result.statuses;
    state.loadedAt = new Date();
    render();
    if (state.openRef) renderDrawer(true);
    if (!quiet) $("updated").textContent = "Updated just now";
  } catch (error) {
    if (error.code !== "auth") toast("Couldn't refresh. Check your connection.");
  }
};

$("refresh").addEventListener("click", async () => { await load(); toast("Up to date"); });

setInterval(() => {
  if (state.token && !document.hidden) load(true);
  if (state.loadedAt) $("updated").textContent = "Updated " + ago(state.loadedAt.toISOString()).replace("1 min ago", "a minute ago");
}, 60000);
document.addEventListener("visibilitychange", () => { if (!document.hidden && state.token) load(true); });

/* Filters */

const filters = { search: $("f-search"), status: $("f-status"), assigned: $("f-assigned"), sort: $("f-sort") };

const fillSelect = (select, options, keep) => {
  const current = select.value;
  select.replaceChildren(...options.map(([value, label]) => el("option", { value, text: label })));
  select.value = keep && options.some(([v]) => v === current) ? current : options[0][0];
};

const filtered = () => {
  const q = filters.search.value.trim().toLowerCase();
  const status = filters.status.value;
  const assigned = filters.assigned.value;
  const list = state.items.filter((item) => {
    if (state.tab !== "all" && item.type !== state.tab) return false;
    if (status === "open" && !OPEN.includes(item.status)) return false;
    if (status === "late" && !isLate(item)) return false;
    if (status !== "open" && status !== "all" && status !== "late" && item.status !== status) return false;
    if (assigned === "none" && item.assignedTo) return false;
    if (assigned === "me" && item.assignedTo.toLowerCase() !== state.name.toLowerCase()) return false;
    if (!["any", "none", "me"].includes(assigned) && item.assignedTo !== assigned) return false;
    if (q) {
      const hay = [item.name, item.town, item.phone, item.email, item.details, item.kind, item.ref, item.assignedTo].join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  const sort = filters.sort.value;
  const key = sort === "updated" ? "updated" : "created";
  list.sort((a, b) => (sort === "old" ? 1 : -1) * (new Date(a[key]) - new Date(b[key])));
  return list;
};

Object.values(filters).forEach((f) => f.addEventListener("input", () => renderList()));

/* Rendering */

const statusChip = (s) => el("span", { class: "chip s-" + slug(s), text: s });
const typeTag = (item) => item.type === "Prayer request" ? el("span", { class: "tag t-prayer", text: "Prayer" })
  : item.type === "Volunteer sign-up" ? el("span", { class: "tag t-volunteer", text: "Volunteer" })
  : el("span", { class: "tag", text: item.kind ? item.kind.split(",")[0] : "Help" });

const render = () => {
  const items = state.items;
  const thisMonth = new Date(); thisMonth.setDate(1); thisMonth.setHours(0, 0, 0, 0);
  const stats = [
    { label: "New, need a reply", n: items.filter((i) => i.status === "New").length, cls: "hot", go: { status: "New" } },
    { label: "Waiting over 2 days", n: items.filter(isLate).length, cls: "warn", go: { status: "late" } },
    { label: "In progress", n: items.filter((i) => ["Contacted", "Scheduled", "In progress"].includes(i.status)).length, go: { status: "open" } },
    { label: "Done this month", n: items.filter((i) => i.status === "Done" && new Date(i.updated) >= thisMonth).length, go: { status: "Done" } },
    { label: "Open prayer requests", n: items.filter((i) => i.type === "Prayer request" && OPEN.includes(i.status)).length, go: { tab: "Prayer request", status: "open" } },
    { label: "Volunteer sign-ups", n: items.filter((i) => i.type === "Volunteer sign-up").length, go: { tab: "Volunteer sign-up", status: "all" } },
  ];
  $("stats").replaceChildren(...stats.map((s) => el("button", {
    type: "button", class: "stat " + (s.cls === "warn" && !s.n ? "" : s.cls || ""),
    onclick: () => {
      state.tab = s.go.tab || "all";
      filters.status.value = s.go.status;
      renderTabs();
      renderList();
    },
  }, el("b", { text: String(s.n) }), el("span", { text: s.label }))));

  fillSelect(filters.status, [["open", "Open (not finished)"], ["all", "All statuses"], ["late", "Waiting over 2 days"], ...state.statuses.map((s) => [s, s])], true);
  const names = [...new Set(items.map((i) => i.assignedTo).filter(Boolean))].sort();
  fillSelect(filters.assigned, [["any", "Anyone"], ["me", "Assigned to me"], ["none", "Not assigned"], ...names.map((n) => [n, n])], true);
  $("team-names").replaceChildren(...[...new Set([...names, state.name])].map((n) => el("option", { value: n })));

  renderTabs();
  renderList();
};

const renderTabs = () => {
  $("tabs").replaceChildren(...TYPE_TABS.map((t) => {
    const n = state.items.filter((i) => (t.id === "all" || i.type === t.id) && OPEN.includes(i.status)).length;
    return el("button", {
      type: "button", role: "tab", "aria-selected": String(state.tab === t.id),
      onclick: () => { state.tab = t.id; renderTabs(); renderList(); },
    }, t.label, el("span", { class: "n", text: String(n), title: "Open" }));
  }));
};

const renderList = () => {
  const list = filtered();
  $("count").textContent = list.length === 1 ? "1 request" : `${list.length} requests`;
  if (!list.length) {
    $("list").replaceChildren(el("div", { class: "empty" },
      el("p", { text: state.items.length ? "Nothing matches these filters." : "No requests yet. New ones from the website will show up here." }),
      state.items.length ? el("button", { type: "button", class: "link-btn", text: "Show everything", onclick: () => {
        state.tab = "all"; filters.status.value = "all"; filters.assigned.value = "any"; filters.search.value = ""; renderTabs(); renderList();
      } }) : null));
    return;
  }
  $("list").replaceChildren(...list.map((item) => el("button", {
    type: "button", class: "item" + (isLate(item) ? " is-late" : item.status === "New" ? " is-new" : ""),
    onclick: () => openDrawer(item.ref),
  },
    el("div", {}, statusChip(item.status)),
    el("div", { class: "item-main" },
      el("div", { class: "item-title" }, item.name || "(no name given)", typeTag(item),
        item.private ? el("span", { class: "tag t-private", text: "Pastors only" }) : null),
      el("div", { class: "item-sub", text: [item.town, item.phone].filter(Boolean).join(" · ") }),
      el("div", { class: "item-text", text: item.details })),
    el("div", { class: "item-side" },
      el("div", { class: isLate(item) ? "late" : "", text: ago(item.created) }),
      el("div", { text: item.assignedTo ? "→ " + item.assignedTo : "Not assigned" })),
  )));
};

/* Detail drawer */

let lastFocus = null;
const current = () => state.items.find((i) => i.ref === state.openRef);

const openDrawer = (ref) => {
  lastFocus = document.activeElement;
  state.openRef = ref;
  $("d-note").value = "";
  $("d-status-msg").textContent = "";
  renderDrawer();
  $("scrim").hidden = false;
  $("drawer").hidden = false;
  document.body.style.overflow = "hidden";
  $("drawer").focus();
};

const closeDrawer = () => {
  state.openRef = null;
  $("scrim").hidden = true;
  $("drawer").hidden = true;
  document.body.style.overflow = "";
  lastFocus?.focus?.();
};

$("d-close").addEventListener("click", closeDrawer);
$("scrim").addEventListener("click", closeDrawer);
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && state.openRef) closeDrawer(); });

const renderDrawer = (fromRefresh) => {
  const item = current();
  if (!item) return closeDrawer();

  $("d-name").textContent = item.name || "(no name given)";
  $("d-meta").replaceChildren(statusChip(item.status), typeTag(item),
    item.private ? el("span", { class: "tag t-private", text: "Pastors only" }) : null,
    el("span", { text: item.ref + " · " + fullDate(item.created) }));

  const quick = [];
  if (item.phone) {
    quick.push(el("a", { href: "tel:" + digits(item.phone), text: "Call " + item.phone }));
    quick.push(el("a", { class: "alt", href: "sms:" + digits(item.phone), text: "Text" }));
  }
  if (item.email) {
    const subject = encodeURIComponent("Your " + item.type.toLowerCase() + " · Dimension Abundant Life Ministries");
    quick.push(el("a", { class: "alt", href: `mailto:${item.email}?subject=${subject}`, text: "Email" }));
  }
  if (item.town && item.type !== "Prayer request") {
    quick.push(el("a", { class: "alt", href: "https://www.google.com/maps/search/" + encodeURIComponent(item.town + ", CT"), target: "_blank", rel: "noopener", text: "Map" }));
  }
  $("d-quick").replaceChildren(...quick);
  $("d-quick").hidden = !quick.length;

  const rows = [
    ["Kind of help", item.kind], ["Town", item.town], ["Phone", item.phone], ["Email", item.email],
    ["Help is for", item.for], ["Best way to reach", item.contact], ["Best time", item.when],
    ["Would like a call", item.callback], ["Last updated", item.updated && fullDate(item.updated)],
  ].filter(([, v]) => v);
  $("d-facts").replaceChildren(
    ...rows.flatMap(([k, v]) => [el("dt", { text: k }), el("dd", { text: v })]),
    el("dd", { class: "details", text: item.details || "" }));

  $("d-status").replaceChildren(...state.statuses.map((s) => el("button", {
    type: "button", "aria-pressed": String(item.status === s), text: s,
    onclick: () => save({ status: s }, "Status changed to " + s),
  })));

  if (!fromRefresh || document.activeElement !== $("d-assign")) $("d-assign").value = item.assignedTo || "";

  const notes = [...(item.notes || [])].reverse();
  $("d-activity").replaceChildren(
    ...notes.map((n) => el("li", { class: n.auto ? "auto" : "" },
      el("span", { class: "when", text: fullDate(n.at) + " · " + n.by }),
      el("span", { class: "text", text: n.text }))),
    el("li", { class: "auto" }, el("span", { class: "when", text: fullDate(item.created) }), el("span", { class: "text", text: "Request received through the website" })));
};

const save = async (changes, message) => {
  const item = current();
  if (!item) return;
  const msg = $("d-status-msg");
  msg.classList.remove("error");
  msg.textContent = "Saving…";
  try {
    await api("update", { ref: item.ref, ...changes });
    msg.textContent = "";
    toast(message);
    await load(true);
  } catch (error) {
    if (error.code === "auth") return;
    msg.classList.add("error");
    msg.textContent = "Couldn't save that. Please try again.";
  }
};

$("d-assign-save").addEventListener("click", () => {
  const who = $("d-assign").value.trim();
  save({ assignedTo: who }, who ? "Assigned to " + who : "Unassigned");
});
$("d-assign-me").addEventListener("click", () => {
  $("d-assign").value = state.name;
  save({ assignedTo: state.name }, "Assigned to you");
});
$("d-note-save").addEventListener("click", async () => {
  const note = $("d-note").value.trim();
  if (!note) return $("d-note").focus();
  await save({ note }, "Note added");
  if (!$("d-status-msg").classList.contains("error")) $("d-note").value = "";
});

$("d-copy").addEventListener("click", async () => {
  const item = current();
  const lines = [
    `${item.type} · ${item.ref}`,
    `Name: ${item.name || "(not given)"}`,
    item.phone && `Phone: ${item.phone}`,
    item.town && `Town: ${item.town}`,
    item.kind && `Help with: ${item.kind}`,
    item.when && `Best time: ${item.when}`,
    "",
    item.details,
  ].filter((l) => l !== undefined && l !== null && l !== false);
  try {
    await navigator.clipboard.writeText(lines.join("\n"));
    toast(item.private ? "Copied. This one is marked pastors only, so share carefully." : "Copied. Paste it into a text or email.");
  } catch {
    toast("Couldn't copy on this device.");
  }
});

$("d-print").addEventListener("click", () => {
  document.body.classList.add("printing-detail");
  window.print();
});
window.addEventListener("afterprint", () => document.body.classList.remove("printing-detail"));

/* Export */

$("export").addEventListener("click", () => {
  const list = filtered();
  const cols = ["ref", "created", "type", "status", "assignedTo", "name", "phone", "email", "town", "for", "kind", "contact", "when", "callback", "private", "details", "updated"];
  const esc = (v) => {
    let s = String(v ?? "");
    if (/^[=+\-@]/.test(s)) s = "'" + s;
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const rows = list.map((i) => [...cols.map((c) => esc(i[c])), esc((i.notes || []).map((n) => `${n.at.slice(0, 10)} ${n.by}: ${n.text}`).join(" | "))].join(","));
  const csv = [[...cols, "notes"].join(","), ...rows].join("\n");
  const link = el("a", { href: URL.createObjectURL(new Blob([csv], { type: "text/csv" })), download: `give-back-requests-${new Date().toISOString().slice(0, 10)}.csv` });
  document.body.append(link);
  link.click();
  link.remove();
  toast(`Exported ${list.length} request${list.length === 1 ? "" : "s"}`);
});

/* Demo mode: made-up requests for practice, kept only in memory. */

const demoItems = () => {
  const at = (hoursAgo) => new Date(Date.now() - hoursAgo * 36e5).toISOString();
  const base = { email: "", for: "Myself", contact: "Phone call", when: "", callback: "", private: "", assignedTo: "", notes: [] };
  return [
    { ...base, ref: "GB-DEMO-0001", created: at(3), updated: at(3), type: "Help request", status: "New", name: "Sample: Dorothy", phone: "(555) 010-0001", town: "Rocky Hill", kind: "Phone, computer, or internet", details: "My grandson sent me a video call link and I don't know how to join it.", when: "Afternoons" },
    { ...base, ref: "GB-DEMO-0002", created: at(70), updated: at(70), type: "Help request", status: "New", name: "Sample: Harold", phone: "(555) 010-0002", town: "Wethersfield", kind: "Paperwork or forms", details: "Got a letter about my benefits and could use help reading it." },
    { ...base, ref: "GB-DEMO-0003", created: at(30), updated: at(5), type: "Prayer request", status: "Contacted", name: "Sample: Anon", phone: "", town: "", kind: "", details: "Please pray for my sister's surgery next week.", callback: "No, just pray for me", notes: [{ at: at(5), by: "Pastor (sample)", text: "Prayed over this at Wednesday prayer meeting." }] },
    { ...base, ref: "GB-DEMO-0004", created: at(120), updated: at(20), type: "Help request", status: "Scheduled", name: "Sample: Margaret", phone: "(555) 010-0004", town: "Cromwell", kind: "Around the house", details: "Leaves need raking before the snow.", assignedTo: "Youth group (sample)", notes: [{ at: at(20), by: "Team (sample)", text: "Youth group coming Saturday 10 am." }] },
    { ...base, ref: "GB-DEMO-0005", created: at(50), updated: at(50), type: "Volunteer sign-up", status: "New", name: "Sample: Kofi", phone: "(555) 010-0005", town: "", kind: "", details: "Happy to do tech help on Saturdays." },
    { ...base, ref: "GB-DEMO-0006", created: at(400), updated: at(300), type: "Help request", status: "Done", name: "Sample: Walter", phone: "(555) 010-0006", town: "Rocky Hill", kind: "Phone, computer, or internet", details: "Set up larger text on iPhone.", assignedTo: "Team (sample)" },
    { ...base, ref: "GB-DEMO-0007", created: at(8), updated: at(8), type: "Prayer request", status: "New", name: "Sample: Grace", phone: "(555) 010-0007", town: "", kind: "", details: "Struggling since my husband passed. Would love someone to pray with me.", callback: "Yes, please call me", private: "Yes" },
  ];
};

let demoData = [];
const demoApi = async (action, extra) => {
  await new Promise((r) => setTimeout(r, 150));
  if (action === "list") return { ok: true, items: structuredClone(demoData), statuses: state.statuses };
  if (action === "update") {
    const item = demoData.find((i) => i.ref === extra.ref);
    const now = new Date().toISOString();
    if (extra.status && extra.status !== item.status) { item.notes.push({ at: now, by: state.name, text: `Status: ${item.status} → ${extra.status}`, auto: true }); item.status = extra.status; }
    if (typeof extra.assignedTo === "string" && extra.assignedTo !== item.assignedTo) { item.assignedTo = extra.assignedTo; item.notes.push({ at: now, by: state.name, text: extra.assignedTo ? "Assigned to " + extra.assignedTo : "Unassigned", auto: true }); }
    if (extra.note) item.notes.push({ at: now, by: state.name, text: extra.note });
    item.updated = now;
    return { ok: true };
  }
  return { ok: true };
};

$("demo-btn").addEventListener("click", async () => {
  state.demo = true;
  state.token = "demo";
  state.name = $("login-name").value.trim() || "You";
  demoData = demoItems();
  showDash();
  await load();
});
$("demo-exit").addEventListener("click", () => signOut());

/* Start */

try { $("login-name").value = localStorage.getItem("teamName") || ""; } catch {}
try {
  const saved = JSON.parse(sessionStorage.getItem("team") || "null");
  if (saved?.token && PROJECT.backendUrl) {
    state.token = saved.token;
    state.name = saved.name;
    showDash();
    load();
  }
} catch {}
