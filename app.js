/*
 * 5-a-side Subs — screens, storage, live match, wake lock and sound.
 * Pure rotation/clock logic lives in logic.js; rotations are data in templates.js.
 */
(function () {
  "use strict";

  const L = window.Logic;
  const TPL = typeof TEMPLATES === "object" && TEMPLATES ? TEMPLATES : null;
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  /* ---------------- Storage ---------------- */

  const NS = "subs5.";
  const store = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(NS + key);
        return raw == null ? fallback : JSON.parse(raw);
      } catch (e) {
        return fallback;
      }
    },
    set(key, value) {
      try {
        if (value == null) localStorage.removeItem(NS + key);
        else localStorage.setItem(NS + key, JSON.stringify(value));
      } catch (e) {
        console.error(`Could not save "${key}"`, e);
      }
    },
  };

  /* ---------------- Environment ---------------- */

  const params = new URLSearchParams(location.search);
  const urlSpeed = parseSpeed(params.get("speed"));
  const DEV = params.has("dev") || location.protocol === "file:" ||
    /^(localhost|127\.\d+\.\d+\.\d+|\[::1\]|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|.+\.local|.+\.localhost|.+\.test)$/i.test(location.hostname);

  function parseSpeed(value) {
    const n = Number(value);
    return value != null && Number.isFinite(n) && n > 0 ? Math.min(n, 1000) : 1;
  }

  // Template check: logged at startup in development; always used to block a broken rotation.
  const templateErrors = !TPL
    ? ["templates.js did not load. Check it for a typo."]
    : DEV ? L.checkTemplates(TPL) : L.validateTemplates(TPL);
  if (!TPL) console.error("[templates] " + templateErrors[0]);

  /* ---------------- State ---------------- */

  let squad = (store.get("squad", []) || []).filter((p) => p && typeof p.id === "string" && typeof p.name === "string");
  let setup = Object.assign({ attending: [], keeper: null, starters: [] }, store.get("setup", {}));
  let review = store.get("review", null); // { size, keeper, roles: {A: id, ...} } waiting for START
  let match = loadMatch();                // live match, see startMatch()
  let soundOn = store.get("sound", false) === true;

  function loadMatch() {
    const m = store.get("match", null);
    const ok = m && m.plan && Array.isArray(m.plan.periods) && Array.isArray(m.plan.stoppages) &&
      Array.isArray(m.plan.outfield) && m.plan.names && typeof m.kickoffAt === "number";
    if (m && !ok) store.set("match", null);
    return ok ? m : null;
  }
  const saveMatch = () => store.set("match", match);
  const saveSquad = () => store.set("squad", squad);
  const saveSetup = () => store.set("setup", setup);
  const saveReview = () => store.set("review", review);

  /* ---------------- Icons ---------------- */

  const SPEAKER = '<path d="M3.5 9.5v5h3.8l4.7 4V5.5l-4.7 4z" fill="currentColor"/>';
  const ICON = {
    pause: '<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><rect x="6" y="5" width="4.2" height="14" rx="1.2" fill="currentColor"/><rect x="13.8" y="5" width="4.2" height="14" rx="1.2" fill="currentColor"/></svg>',
    play: '<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><path d="M8 5.6v12.8a1 1 0 0 0 1.5.86l10.3-6.4a1 1 0 0 0 0-1.72L9.5 4.74A1 1 0 0 0 8 5.6z" fill="currentColor"/></svg>',
    soundOn: `<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">${SPEAKER}<path d="M15.5 8.6a5 5 0 0 1 0 6.8M18.4 5.9a9 9 0 0 1 0 12.2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
    soundOff: `<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">${SPEAKER}<path d="M16 9.5l5 5M21 9.5l-5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
    x: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
    check: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  };

  /* ---------------- Screens ---------------- */

  const screens = {
    squad: $("#screen-squad"),
    setup: $("#screen-setup"),
    review: $("#screen-review"),
    live: $("#screen-live"),
  };
  const RENDER = { squad: renderSquad, setup: renderSetup, review: renderReview };
  let current = "";

  function show(name) {
    current = name;
    for (const [key, el] of Object.entries(screens)) el.hidden = key !== name;
    if (name === "live") {
      lastLiveKey = "";
      startTicker();
      drawLive();
    } else {
      stopTicker();
      delete document.documentElement.dataset.live;
      setThemeColor(THEME.normal);
      store.set("screen", name);
      RENDER[name]();
    }
    updateTestBadges();
    window.scrollTo(0, 0);
  }

  function say(el, text, kind) {
    el.textContent = text || "";
    el.classList.toggle("is-error", kind === "error");
    el.classList.toggle("is-ok", kind === "ok");
  }

  function updateTestBadges() {
    for (const el of $$("[data-test]")) {
      el.hidden = urlSpeed === 1;
      el.textContent = `TEST x${urlSpeed}`;
    }
    const speed = match ? match.speed || 1 : 1;
    const live = $("#live-test");
    live.hidden = speed === 1;
    live.textContent = `TEST x${speed}`;
  }

  /* ================================================================ */
  /* SCREEN 1 — SQUAD                                                  */
  /* ================================================================ */

  const squadMsg = $("#squad-msg");
  let editingId = null;
  let armedDeleteId = null;
  let armTimer = 0;

  const byName = (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  const sorted = (list) => list.slice().sort(byName);
  const cleanName = (s) => String(s || "").replace(/\s+/g, " ").trim().slice(0, 30);
  const newId = () => "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  function playerName(id) {
    const p = squad.find((x) => x.id === id);
    return p ? p.name : "?";
  }

  function nameTaken(name, exceptId) {
    const key = name.toLocaleLowerCase();
    return squad.some((p) => p.id !== exceptId && p.name.toLocaleLowerCase() === key);
  }

  function renderSquad() {
    $("#squad-count").textContent = squad.length ? String(squad.length) : "";
    $("#squad-empty").hidden = squad.length > 0;
    $("#insecure-note").hidden = window.isSecureContext;
    $("#squad-list").innerHTML = sorted(squad).map(squadRow).join("");
    const input = $("#rename-input");
    if (input) {
      input.focus();
      input.setSelectionRange(0, input.value.length);
    }
  }

  function squadRow(p) {
    if (p.id === editingId) {
      return `<li class="row is-editing">
        <input id="rename-input" class="field" data-id="${esc(p.id)}" value="${esc(p.name)}" maxlength="30"
               autocapitalize="words" autocorrect="off" spellcheck="false" enterkeyhint="done">
        <button class="btn btn-primary" data-act="rename-save" data-id="${esc(p.id)}">Save</button>
      </li>`;
    }
    const del = p.id === armedDeleteId
      ? `<button class="btn btn-danger" data-act="delete" data-id="${esc(p.id)}">Delete</button>`
      : `<button class="icon-btn" data-act="delete-arm" data-id="${esc(p.id)}" aria-label="Delete ${esc(p.name)}">${ICON.x}</button>`;
    return `<li class="row">
      <button class="row-name" data-act="rename" data-id="${esc(p.id)}">${esc(p.name)}</button>${del}
    </li>`;
  }

  function addOne(raw) {
    const name = cleanName(raw);
    if (!name) return say(squadMsg, "Type a name first.", "error"), false;
    if (nameTaken(name)) return say(squadMsg, `${name} is already in the squad.`, "error"), false;
    squad.push({ id: newId(), name });
    saveSquad();
    renderSquad();
    say(squadMsg, `Added ${name}.`, "ok");
    return true;
  }

  function bulkAdd() {
    const box = $("#bulk-text");
    const names = box.value
      .split(/[\n,;]+/)
      .map((s) => cleanName(s.replace(/^\s*(?:\d+[.)]|[-*•·])\s*/, ""))) // strip "1." / "-" list markers
      .filter(Boolean);
    if (!names.length) return say(squadMsg, "Paste some names first.", "error");
    let added = 0;
    let skipped = 0;
    for (const name of names) {
      if (nameTaken(name)) skipped++;
      else {
        squad.push({ id: newId(), name });
        added++;
      }
    }
    saveSquad();
    box.value = "";
    $("#bulk-box").hidden = true;
    renderSquad();
    say(squadMsg, `Added ${added}` + (skipped ? ` · skipped ${skipped} already in the squad` : "") + ".", added ? "ok" : "error");
  }

  function commitRename(id) {
    if (editingId !== id) return;
    const input = $("#rename-input");
    const name = cleanName(input ? input.value : "");
    editingId = null;
    const p = squad.find((x) => x.id === id);
    if (p && name && name !== p.name) {
      if (nameTaken(name, id)) say(squadMsg, `${name} is already in the squad.`, "error");
      else {
        p.name = name;
        saveSquad();
        say(squadMsg, "Renamed.", "ok");
      }
    }
    renderSquad();
  }

  function startRename(id) {
    if (editingId) commitRename(editingId);
    editingId = id;
    armedDeleteId = null;
    renderSquad();
  }

  function armDelete(id) {
    if (editingId) commitRename(editingId);
    armedDeleteId = id;
    clearTimeout(armTimer);
    armTimer = setTimeout(() => {
      armedDeleteId = null;
      if (current === "squad") renderSquad();
    }, 5000);
    renderSquad();
  }

  function deletePlayer(id) {
    const p = squad.find((x) => x.id === id);
    if (!p) return;
    squad = squad.filter((x) => x.id !== id);
    armedDeleteId = null;
    saveSquad();
    setup.attending = setup.attending.filter((x) => x !== id);
    setup.starters = setup.starters.filter((x) => x !== id);
    if (setup.keeper === id) setup.keeper = null;
    saveSetup();
    if (review && reviewIds().includes(id)) {
      review = null;
      saveReview();
    }
    renderSquad();
    say(squadMsg, `Removed ${p.name}.`);
  }

  /* ================================================================ */
  /* SCREEN 2 — MATCH SETUP                                            */
  /* ================================================================ */

  const ORDINAL = ["1st", "2nd", "3rd"];

  /** Normalises the saved selections against the squad and derives the bench. */
  function setupModel() {
    const known = new Set(squad.map((p) => p.id));
    setup.attending = setup.attending.filter((id) => known.has(id));
    if (!setup.attending.includes(setup.keeper)) setup.keeper = null;
    const attending = sorted(squad.filter((p) => setup.attending.includes(p.id)));
    const outfield = attending.filter((p) => p.id !== setup.keeper);
    setup.starters = setup.starters.filter((id) => outfield.some((p) => p.id === id)).slice(0, 4);
    const bench = outfield.filter((p) => !setup.starters.includes(p.id)); // E, F, G in the order shown
    return { attending, outfield, bench, keeper: setup.keeper, starters: setup.starters };
  }

  /** Why the rotation can't be generated yet ("" = ready), and whether that's an error. */
  function setupProblem(m) {
    const n = m.attending.length;
    if (n === 0) return ["Tap the players who are here (6 to 8)."];
    if (n < 6) return [`Only ${n} selected. You need 6 to 8 players.`, true];
    if (n > 8) return [`${n} selected. The maximum is 8 players.`, true];
    if (!m.keeper) return ["Tap who is in goal."];
    const left = 4 - m.starters.length;
    if (left > 0) return [`Tap ${left} more starter${left === 1 ? "" : "s"}.`];
    if (!TPL || L.validateTemplate(n, TPL[n]).length) return [`The ${n}-player rotation in templates.js has errors.`, true];
    return [""];
  }

  function chip(act, p, badge) {
    return `<button class="chip${badge ? " is-on" : ""}" data-act="${act}" data-id="${esc(p.id)}">
      <span class="chip-name">${esc(p.name)}</span>${badge ? `<span class="chip-badge">${badge}</span>` : ""}
    </button>`;
  }

  function renderSetup() {
    const m = setupModel();
    const n = m.attending.length;
    $("#att-count").textContent = n ? `${n} selected` : "";
    $("#att-clear").hidden = !n;

    $("#grid-attend").innerHTML = squad.length
      ? sorted(squad).map((p) => chip("attend", p, setup.attending.includes(p.id) ? ICON.check : "")).join("")
      : `<div class="grid-empty">Your squad is empty. <button class="link-btn" data-act="go" data-to="squad">Add players</button></div>`;

    $("#grid-keeper").innerHTML = n
      ? m.attending.map((p) => chip("keeper", p, p.id === m.keeper ? "GK" : "")).join("")
      : `<div class="grid-empty">Pick who's here first.</div>`;

    $("#grid-start").innerHTML = m.keeper && m.outfield.length
      ? m.outfield.map((p) => {
        const i = m.starters.indexOf(p.id);
        return chip("starter", p, i >= 0 ? String(i + 1) : "");
      }).join("")
      : `<div class="grid-empty">Pick the goalkeeper first.</div>`;

    const showBench = m.keeper && m.starters.length === 4 && m.bench.length > 0;
    $("#bench-wrap").hidden = !showBench;
    $("#bench-list").innerHTML = showBench
      ? m.bench.map((p, i) => `<span class="bench-chip"><small>${ORDINAL[i] || i + 1 + "th"}</small>${esc(p.name)}</span>`).join("")
      : "";

    const [problem, isError] = setupProblem(m);
    say($("#setup-msg"), problem || `Ready: ${n} players, ${m.bench.length} on the bench.`, problem ? (isError ? "error" : "") : "ok");
    $("#btn-generate").classList.toggle("is-disabled", !!problem);
  }

  function toggleAttend(id) {
    const i = setup.attending.indexOf(id);
    if (i >= 0) setup.attending.splice(i, 1);
    else setup.attending.push(id);
    saveSetup();
    renderSetup();
  }

  function pickKeeper(id) {
    setup.keeper = setup.keeper === id ? null : id;
    setup.starters = setup.starters.filter((x) => x !== id);
    saveSetup();
    renderSetup();
  }

  function pickStarter(id) {
    const i = setup.starters.indexOf(id);
    if (i >= 0) setup.starters.splice(i, 1);
    else if (setup.starters.length < 4) setup.starters.push(id);
    else return say($("#setup-msg"), "Already 4 starters. Tap one to remove it.", "error");
    saveSetup();
    renderSetup();
  }

  function clearSetup() {
    setup = { attending: [], keeper: null, starters: [] };
    saveSetup();
    renderSetup();
  }

  function generate() {
    const m = setupModel();
    const [problem] = setupProblem(m);
    if (problem) return say($("#setup-msg"), problem, "error");
    const order = [...m.starters, ...m.bench.map((p) => p.id)];
    const roles = {};
    L.rolesFor(m.attending.length).forEach((r, i) => { roles[r] = order[i]; });
    review = { size: m.attending.length, keeper: m.keeper, roles };
    saveReview();
    picked = null;
    show("review");
  }

  /* ================================================================ */
  /* SCREEN 3 — REVIEW ROTATION                                        */
  /* ================================================================ */

  let picked = null;

  const reviewIds = () => (review ? [review.keeper, ...Object.values(review.roles)] : []);
  const pct = (ms) => Math.round((ms / L.MATCH_MS) * 100000) / 1000;

  function reviewValid() {
    if (!review || !TPL || !TPL[review.size] || L.validateTemplate(review.size, TPL[review.size]).length) return false;
    if (L.rolesFor(review.size).some((r) => !review.roles[r])) return false;
    const ids = reviewIds();
    return new Set(ids).size === ids.length && ids.every((id) => squad.some((p) => p.id === id));
  }

  const reviewPlan = () => L.buildPlan(review.size, review.keeper, review.roles, TPL[review.size]);

  function renderReview(flashIds) {
    if (!reviewValid()) {
      review = null;
      saveReview();
      return show("setup");
    }
    const plan = reviewPlan();
    const names = (ids) => ids.map((id) => esc(playerName(id))).join(", ");
    $("#review-meta").textContent = `${review.size} players`;

    $("#review-stops").innerHTML = plan.stoppages.map((s) => `
      <li class="stop">
        <div class="stop-time">${L.fmtClock(s.at)}</div>
        <div class="stop-lines">
          <div class="stop-line"><span class="tag tag-off">OFF</span><span>${names(s.off)}</span></div>
          <div class="stop-line"><span class="tag tag-on">ON</span><span>${names(s.on)}</span></div>
        </div>
      </li>`).join("");

    $("#review-players").innerHTML = plan.players.map((p) => {
      const stints = p.stints.map((s) => `${L.fmtClock(s.from)}–${L.fmtClock(s.to)}`).join(" · ");
      const bars = p.stints.map((s) => `<i style="left:${pct(s.from)}%;width:${pct(s.to - s.from)}%"></i>`).join("");
      const cls = "player" + (p.id === picked ? " is-picked" : "") + (flashIds && flashIds.includes(p.id) ? " is-flash" : "");
      return `<li><button class="${cls}" data-act="pick" data-id="${esc(p.id)}">
        <span class="player-main">
          <span class="player-name">${p.gk ? '<span class="gk-tag">GK</span>' : ""}<span>${esc(playerName(p.id))}</span></span>
          <span class="player-stints">${stints}</span>
          <span class="bar">${bars}</span>
        </span>
        <span class="player-total">${L.fmtClock(p.total)}</span>
      </button></li>`;
    }).join("");

    const hint = $("#swap-hint");
    hint.textContent = picked ? `Now tap who swaps with ${playerName(picked)}` : "Tap two players to swap";
    hint.classList.toggle("is-active", !!picked);
  }

  function pick(id) {
    if (!picked || picked === id) {
      picked = picked === id ? null : id;
      return renderReview();
    }
    const a = picked;
    picked = null;
    swapRoles(a, id);
    saveReview();
    renderReview([a, id]);
  }

  /** Swaps whole roles. With the keeper: the outfield player goes in goal, the keeper takes their role. */
  function swapRoles(a, b) {
    const roleOf = (id) => Object.keys(review.roles).find((r) => review.roles[r] === id);
    if (a === review.keeper || b === review.keeper) {
      const gk = review.keeper;
      const other = a === gk ? b : a;
      review.roles[roleOf(other)] = gk;
      review.keeper = other;
    } else {
      const ra = roleOf(a);
      const rb = roleOf(b);
      review.roles[ra] = b;
      review.roles[rb] = a;
    }
  }

  function startMatch() {
    if (!reviewValid()) return show("setup");
    unlockAudio(); // must happen inside the START tap for iOS
    const plan = reviewPlan();
    const names = {};
    for (const id of [plan.keeper, ...plan.outfield]) names[id] = playerName(id);
    match = {
      v: 1,
      plan: {
        size: plan.size,
        keeper: plan.keeper,
        outfield: plan.outfield,   // role order A, B, C...
        periods: plan.periods,     // [{ from, to, on: [ids] }] in match ms
        stoppages: plan.stoppages, // [{ at, off: [ids], on: [ids] }]
        names,
      },
      kickoffAt: Date.now(),
      speed: urlSpeed,
      paused: false,
      pausedAt: null,
      pausedTotal: 0,
      confirmed: 0,                // stoppages confirmed with DONE
      alerted: { warn: -1, sub: -1 },
      over: false,
    };
    saveMatch();
    review = null;
    saveReview();
    picked = null;
    setWakeNotice(false);
    show("live");
    requestWakeLock();
  }

  /* ================================================================ */
  /* SCREEN 4 — LIVE MATCH                                             */
  /* ================================================================ */

  const THEME = { normal: "#0B0B0C", warn: "#F5A524", sub: "#D62828", full: "#15803D" };
  const el = {
    clock: $("#clock"),
    next: $("#next-sub"),
    pitch: $("#pitch"),
    bench: $("#bench"),
    warnCount: $("#warn-count"),
    warnSwap: $("#warn-swap"),
    subSwap: $("#sub-swap"),
    pause: $("#btn-pause"),
    sound: $("#btn-sound"),
    overlay: $("#pause-overlay"),
    pauseClock: $("#pause-clock"),
    wake: $("#wake-notice"),
  };
  let lastLiveKey = "";
  let ticker = 0;
  let lastDoneAt = 0;

  function setThemeColor(color) {
    const meta = $('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", color);
  }

  function setText(node, text) {
    if (node.textContent !== text) node.textContent = text;
  }

  function setHtml(node, html) {
    if (node.dataset.html !== html) {
      node.dataset.html = html;
      node.innerHTML = html;
    }
  }

  // The interval only redraws; time always comes from the stored timestamps.
  function startTicker() {
    stopTicker();
    if (!match) return;
    ticker = setInterval(drawLive, Math.max(16, Math.min(200, Math.round(200 / (match.speed || 1)))));
  }

  function stopTicker() {
    clearInterval(ticker);
    ticker = 0;
  }

  function drawLive() {
    if (!match || current !== "live") return;
    const st = L.liveStatus(match, Date.now());

    const key = `${st.mode}|${st.idx}`;
    if (key !== lastLiveKey) {
      lastLiveKey = key;
      buildLive(st);
    }

    setText(el.clock, L.fmtClock(st.t));
    if (st.mode === "normal") {
      setHtml(el.next, st.next
        ? `Next sub <b>${L.fmtClock(st.next.at)}</b> · in <b>${L.fmtCountdown(st.next.at - st.t)}</b>`
        : `No more subs · full time in <b>${L.fmtCountdown(L.MATCH_MS - st.t)}</b>`);
    } else if (st.mode === "warn") {
      setText(el.warnCount, L.fmtCountdown(st.next.at - st.t));
    }

    const paused = match.paused && st.mode !== "full";
    el.overlay.hidden = !paused;
    if (paused) setText(el.pauseClock, L.fmtClock(st.t));

    alerts(st);

    if (st.mode === "full") {
      if (!match.over) {
        match.over = true;
        saveMatch();
      }
      stopTicker();
      releaseWakeLock();
    }
  }

  /** Rebuilds the parts of the live screen that only change with the mode or lineup. */
  function buildLive(st) {
    document.documentElement.dataset.live = st.mode;
    setThemeColor(THEME[st.mode]);
    const plan = match.plan;
    const nm = (id) => esc(plan.names[id] || "?");

    if (st.mode === "normal") {
      const on = plan.periods[Math.min(st.idx, plan.periods.length - 1)].on;
      el.pitch.innerHTML =
        `<li><span class="gk">GK</span><span class="nm">${nm(plan.keeper)}</span></li>` +
        on.map((id) => `<li><span></span><span class="nm">${nm(id)}</span></li>`).join("");
      const bench = plan.outfield.filter((id) => !on.includes(id));
      el.bench.innerHTML = bench.length ? bench.map(nm).join(" · ") : "—";
    } else if (st.mode === "warn" || st.mode === "sub") {
      const col = (ids) => ids.map((id) => `<div>${nm(id)}</div>`).join("");
      const html = `<div class="swap-tag">OFF</div><div class="swap-names">${col(st.next.off)}</div>
                    <div class="swap-tag">ON</div><div class="swap-names">${col(st.next.on)}</div>`;
      const box = st.mode === "warn" ? el.warnSwap : el.subSwap;
      box.innerHTML = html;
      box.classList.remove("is-new");
      void box.offsetWidth; // restart the fade-in so back-to-back subs visibly change
      box.classList.add("is-new");
    }
    updatePauseButton();
    updateSoundButton();
  }

  function alerts(st) {
    if (match.paused) return;
    const a = match.alerted || (match.alerted = { warn: -1, sub: -1 });
    if (st.mode === "warn" && a.warn < st.idx) {
      a.warn = st.idx;
      saveMatch();
      beep("warn");
    } else if (st.mode === "sub" && a.sub < st.idx) {
      a.sub = st.idx;
      a.warn = Math.max(a.warn, st.idx);
      saveMatch();
      beep("sub");
    }
  }

  function done() {
    if (!match || match.paused) return;
    const now = Date.now();
    const st = L.liveStatus(match, now);
    if (st.mode !== "sub") return;
    if (now - lastDoneAt < 900) return; // a double tap must not also confirm a following sub
    lastDoneAt = now;
    match.confirmed = st.idx + 1;
    saveMatch();
    drawLive();
  }

  function pause() {
    if (!match || match.paused || match.over) return;
    match.paused = true;
    match.pausedAt = Date.now();
    saveMatch();
    updatePauseButton();
    drawLive();
  }

  function resume() {
    if (!match || !match.paused) return;
    match.pausedTotal = (match.pausedTotal || 0) + Math.max(0, Date.now() - match.pausedAt);
    match.paused = false;
    match.pausedAt = null;
    saveMatch();
    updatePauseButton();
    drawLive();
  }

  function updatePauseButton() {
    const paused = !!(match && match.paused);
    el.pause.innerHTML = paused ? ICON.play : ICON.pause;
    el.pause.setAttribute("aria-label", paused ? "Resume" : "Pause");
  }

  function updateSoundButton() {
    el.sound.innerHTML = soundOn ? ICON.soundOn : ICON.soundOff;
    el.sound.setAttribute("aria-label", soundOn ? "Sound on" : "Sound off");
    el.sound.setAttribute("aria-pressed", String(soundOn));
  }

  function openSheet() {
    $("#sheet-menu").hidden = false;
    $("#sheet-confirm").hidden = true;
    $("#sheet").hidden = false;
  }

  function closeSheet() {
    $("#sheet").hidden = true;
  }

  let askedEndAt = 0;

  function askEnd() {
    askedEndAt = Date.now();
    $("#sheet-menu").hidden = true;
    $("#sheet-confirm").hidden = false;
  }

  function confirmEnd() {
    // "Yes" sits where "End match early" was: ignore the second half of a double tap.
    if (Date.now() - askedEndAt < 700) return;
    endMatch();
  }

  /** Used by both "End match early" (after confirmation) and "Finish". */
  function endMatch() {
    match = null;
    saveMatch();
    stopTicker();
    releaseWakeLock();
    closeSheet();
    setWakeNotice(false);
    show("setup");
  }

  /* ---------------- Wake lock ---------------- */

  let wakeLock = null;
  let wakePending = false;

  async function requestWakeLock() {
    if (!match || match.over || document.visibilityState !== "visible" || wakeLock || wakePending) return;
    if (!("wakeLock" in navigator)) return setWakeNotice(true);
    wakePending = true;
    try {
      const lock = await navigator.wakeLock.request("screen");
      wakeLock = lock;
      lock.addEventListener("release", () => {
        if (wakeLock === lock) wakeLock = null;
      });
      setWakeNotice(false);
      if (!match || match.over) releaseWakeLock();
    } catch (e) {
      console.warn("Wake lock unavailable:", e && e.message);
      setWakeNotice(true);
    } finally {
      wakePending = false;
    }
  }

  function releaseWakeLock() {
    const lock = wakeLock;
    wakeLock = null;
    if (lock) lock.release().catch(() => {});
  }

  function setWakeNotice(on) {
    el.wake.hidden = !on;
  }

  /* ---------------- Sound (Web Audio, no files) ---------------- */

  let actx = null;
  const BEEPS = {
    warn: { count: 1, freq: 880, dur: 0.22 },
    sub: { count: 3, freq: 1175, dur: 0.18 },
    check: { count: 1, freq: 660, dur: 0.09 },
  };

  /** Creates/resumes the AudioContext. Call from inside a tap so iOS allows it. */
  function unlockAudio() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      // "playback" lets beeps sound even with the ring/silent switch on (Safari 16.4+).
      if (soundOn && navigator.audioSession) navigator.audioSession.type = "playback";
      if (!actx) actx = new AC();
      if (actx.state !== "running") actx.resume().catch(() => {});
      const src = actx.createBufferSource();
      src.buffer = actx.createBuffer(1, 1, 22050);
      src.connect(actx.destination);
      src.start(0);
    } catch (e) {
      console.warn("Audio unavailable:", e && e.message);
    }
  }

  function beep(kind) {
    if (!soundOn || !actx) return;
    if (actx.state === "running") return playBeep(BEEPS[kind]);
    // Not unlocked (e.g. after a reload): try, but never play a stale beep later.
    const asked = Date.now();
    actx.resume().then(() => {
      if (Date.now() - asked < 400) playBeep(BEEPS[kind]);
    }).catch(() => {});
  }

  function playBeep(b) {
    try {
      const t0 = actx.currentTime + 0.03;
      for (let i = 0; i < b.count; i++) {
        const t = t0 + i * (b.dur + 0.12);
        const osc = actx.createOscillator();
        const gain = actx.createGain();
        osc.type = "square";
        osc.frequency.value = b.freq;
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(0.3, t + 0.012);
        gain.gain.setValueAtTime(0.3, t + b.dur - 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + b.dur);
        osc.connect(gain);
        gain.connect(actx.destination);
        osc.start(t);
        osc.stop(t + b.dur + 0.02);
      }
    } catch (e) {
      console.warn("Beep failed:", e && e.message);
    }
  }

  function toggleSound() {
    soundOn = !soundOn;
    store.set("sound", soundOn);
    if (soundOn) {
      unlockAudio();
      beep("check");
    }
    updateSoundButton();
  }

  /* ================================================================ */
  /* Events                                                            */
  /* ================================================================ */

  document.addEventListener("click", (e) => {
    if (e.target.id === "sheet") return closeSheet(); // tap outside the menu
    const btn = e.target.closest("[data-act]");
    if (!btn) return;
    const id = btn.dataset.id;
    switch (btn.dataset.act) {
      case "go":
        if (editingId) commitRename(editingId);
        armedDeleteId = null;
        say(squadMsg, "");
        return show(btn.dataset.to);
      // Squad
      case "bulk-toggle": {
        const box = $("#bulk-box");
        box.hidden = !box.hidden;
        if (!box.hidden) $("#bulk-text").focus();
        return;
      }
      case "bulk-add": return bulkAdd();
      case "rename": return startRename(id);
      case "rename-save": return commitRename(id);
      case "delete-arm": return armDelete(id);
      case "delete": return deletePlayer(id);
      // Setup
      case "attend": return toggleAttend(id);
      case "keeper": return pickKeeper(id);
      case "starter": return pickStarter(id);
      case "clear-setup": return clearSetup();
      case "generate": return generate();
      // Review
      case "pick": return pick(id);
      case "back":
        picked = null;
        return show("setup");
      case "start": return startMatch();
      // Live
      case "pause": return pause();
      case "resume": return resume();
      case "sound": return toggleSound();
      case "done": return done();
      case "menu": return openSheet();
      case "sheet-close": return closeSheet();
      case "end-ask": return askEnd();
      case "end-confirm": return confirmEnd();
      case "finish": return endMatch();
    }
  });

  $("#add-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = $("#add-name");
    if (addOne(input.value)) input.value = "";
    input.focus();
  });

  $("#squad-list").addEventListener("keydown", (e) => {
    if (e.target.id !== "rename-input") return;
    if (e.key === "Enter") {
      e.preventDefault();
      commitRename(e.target.dataset.id);
    } else if (e.key === "Escape") {
      editingId = null;
      renderSquad();
    }
  });

  $("#squad-list").addEventListener("focusout", (e) => {
    if (e.target.id === "rename-input") commitRename(e.target.dataset.id);
  });

  // Any tap on the live screen re-acquires the wake lock and audio if iOS dropped them.
  function liveTouch() {
    if (!match) return;
    if (!wakeLock) requestWakeLock();
    if (soundOn && (!actx || actx.state !== "running")) unlockAudio();
  }
  screens.live.addEventListener("touchend", liveTouch, { passive: true });
  screens.live.addEventListener("click", liveTouch);

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible" || !match) return;
    requestWakeLock();
    drawLive();
  });
  window.addEventListener("pageshow", () => drawLive());

  /* ---------------- Boot ---------------- */

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator) || !window.isSecureContext) return;
    navigator.serviceWorker.register("sw.js").catch((e) => console.warn("Service worker failed:", e));
  }

  function boot() {
    if (templateErrors.length) {
      const f = $("#fatal");
      f.hidden = false;
      f.textContent = "Rotation templates have problems:\n• " + templateErrors.join("\n• ");
    }
    registerServiceWorker();
    updateSoundButton();
    updatePauseButton();

    if (match) {
      show("live"); // reopened mid-match: straight back to the clock
      requestWakeLock();
      return;
    }
    const last = store.get("screen", "");
    if (!squad.length) show("squad");
    else if (last === "review" && reviewValid()) show("review");
    else show(last === "squad" ? "squad" : "setup");
  }

  boot();
})();
