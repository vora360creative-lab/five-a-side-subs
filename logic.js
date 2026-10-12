/*
 * Pure match logic: no DOM, no storage. Used by app.js in the browser and by
 * validate.js under Node. All times are milliseconds of MATCH time.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.Logic = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const MATCH_MS = 38 * 60 * 1000;
  const WARN_MS = 30 * 1000;
  const SUB_SCREEN_MS = 30 * 1000;      // red SUB screen auto-closes (as DONE) after 30 s of match time
  const TEST_SUB_SCREEN_REAL_MS = 5000; // ...or after 5 real seconds in test mode (speed above x1)
  const ON_PITCH = 4;
  const STOPPAGES = 4;
  const TOTAL_OUTFIELD_MIN = (ON_PITCH * MATCH_MS) / 60000; // 152
  const SIZES = [6, 7, 8];
  const ROLE_LETTERS = ["A", "B", "C", "D", "E", "F", "G"];

  /** Outfield roles for a squad of `size` (keeper excluded). */
  function rolesFor(size) {
    return ROLE_LETTERS.slice(0, size - 1);
  }

  /** "mm:ss" -> ms. Returns NaN for anything else. */
  function parseTime(str) {
    const m = /^(\d{1,3}):([0-5]\d)$/.exec(String(str).trim());
    return m ? (Number(m[1]) * 60 + Number(m[2])) * 1000 : NaN;
  }

  const pad = (n) => String(n).padStart(2, "0");

  /** Match clock: floor to the second, "mm:ss". */
  function fmtClock(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    return pad(Math.floor(s / 60)) + ":" + pad(s % 60);
  }

  /** Countdown: ceil to the second, "m:ss", so it reaches 0:00 exactly on time. */
  function fmtCountdown(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000));
    return Math.floor(s / 60) + ":" + pad(s % 60);
  }

  /** OFF/ON lists for each boundary between consecutive periods. */
  function stoppagesOf(periods) {
    const out = [];
    for (let i = 1; i < periods.length; i++) {
      const prev = periods[i - 1].on;
      const next = periods[i].on;
      out.push({
        at: periods[i].from,
        off: prev.filter((x) => !next.includes(x)),
        on: next.filter((x) => !prev.includes(x)),
      });
    }
    return out;
  }

  /** Contiguous on-pitch intervals for one player/role, adjacent periods merged. */
  function stintsOf(periods, who) {
    const stints = [];
    for (const p of periods) {
      if (!p.on.includes(who)) continue;
      const last = stints[stints.length - 1];
      if (last && last.to === p.from) last.to = p.to;
      else stints.push({ from: p.from, to: p.to });
    }
    return stints;
  }

  const sumStints = (stints) => stints.reduce((t, s) => t + (s.to - s.from), 0);

  /* ---------------------------------------------------------------- */
  /* Template validation                                               */
  /* ---------------------------------------------------------------- */

  /** Returns a list of human-readable problems with one template (empty = OK). */
  function validateTemplate(size, tpl) {
    const errs = [];
    const name = `${size}-player template`;
    if (!tpl || !Array.isArray(tpl.periods) || tpl.periods.length === 0) {
      return [`${name}: missing or has no periods.`];
    }
    const roles = rolesFor(size);
    const periods = [];

    tpl.periods.forEach((p, i) => {
      const label = `${name}, period ${i + 1} (${p && p.from}-${p && p.to})`;
      const from = parseTime(p && p.from);
      const to = parseTime(p && p.to);
      if (Number.isNaN(from) || Number.isNaN(to)) errs.push(`${label}: times must be "mm:ss".`);
      else if (to <= from) errs.push(`${label}: ends before it starts.`);

      const on = Array.isArray(p && p.on) ? p.on : [];
      if (on.length !== ON_PITCH) errs.push(`${label}: has ${on.length} outfield roles, needs exactly ${ON_PITCH}.`);
      if (new Set(on).size !== on.length) errs.push(`${label}: lists a role twice.`);
      const bad = on.filter((r) => !roles.includes(r));
      if (bad.length) errs.push(`${label}: unknown role ${bad.join(", ")} (allowed: ${roles.join(" ")}).`);
      periods.push({ from, to, on });
    });

    // Continuity 00:00 -> 38:00
    if (periods[0].from !== 0) errs.push(`${name}: first period must start at 00:00.`);
    for (let i = 1; i < periods.length; i++) {
      if (periods[i].from !== periods[i - 1].to) {
        errs.push(`${name}: gap or overlap between period ${i} and ${i + 1} (${fmtClock(periods[i - 1].to)} vs ${fmtClock(periods[i].from)}).`);
      }
    }
    if (periods[periods.length - 1].to !== MATCH_MS) {
      errs.push(`${name}: last period must end at ${fmtClock(MATCH_MS)}.`);
    }

    // Starting four and stoppages
    const first = periods[0].on.slice().sort().join(" ");
    if (first !== "A B C D") errs.push(`${name}: first period must be A B C D (the starting four), found ${first}.`);
    const stops = stoppagesOf(periods);
    if (stops.length !== STOPPAGES) errs.push(`${name}: has ${stops.length} stoppages, needs ${STOPPAGES}.`);
    stops.forEach((s, i) => {
      if (!s.off.length) errs.push(`${name}: stoppage ${i + 1} at ${fmtClock(s.at)} changes nobody.`);
    });

    // Minutes
    const total = periods.reduce((t, p) => t + (p.to - p.from) * p.on.length, 0) / 60000;
    if (Math.abs(total - TOTAL_OUTFIELD_MIN) > 1e-9) {
      errs.push(`${name}: total outfield minutes are ${total}, must be ${TOTAL_OUTFIELD_MIN}.`);
    }
    const expected = tpl.expected || {};
    for (const r of roles) {
      const actual = sumStints(stintsOf(periods, r)) / 60000;
      if (!(r in expected)) errs.push(`${name}: no expected minutes for role ${r}.`);
      else if (Math.abs(actual - expected[r]) > 1e-9) {
        errs.push(`${name}: role ${r} plays ${actual} min, expected ${expected[r]}.`);
      }
    }
    for (const r of Object.keys(expected)) {
      if (!roles.includes(r)) errs.push(`${name}: expected minutes given for unknown role ${r}.`);
    }
    return errs;
  }

  /** Validates every supported template. Returns all problems (empty = OK). */
  function validateTemplates(templates) {
    if (!templates || typeof templates !== "object") return ["TEMPLATES is missing (did templates.js load?)."];
    const errs = [];
    for (const size of SIZES) {
      if (!templates[size]) errs.push(`No template for ${size} players.`);
      else errs.push(...validateTemplate(size, templates[size]));
    }
    return errs;
  }

  /** Validate and log a clear result to the console. Returns the problems. */
  function checkTemplates(templates, log) {
    log = log || console;
    const errs = validateTemplates(templates);
    if (errs.length) {
      log.error(`[templates] ${errs.length} check(s) FAILED:\n  - ${errs.join("\n  - ")}`);
    } else {
      log.info(`[templates] All checks passed for ${SIZES.join(", ")} players: 4 per period, continuous 00:00-38:00, ${TOTAL_OUTFIELD_MIN} outfield minutes, minutes per role as expected.`);
    }
    return errs;
  }

  /* ---------------------------------------------------------------- */
  /* Plans                                                             */
  /* ---------------------------------------------------------------- */

  /**
   * Turns a template + role assignment into a concrete plan.
   *   roles: { A: playerId, B: playerId, ... }
   * Returns periods/stoppages in player ids, plus per-player stints.
   */
  function buildPlan(size, keeper, roles, tpl) {
    const letters = rolesFor(size);
    const periods = tpl.periods.map((p) => ({
      from: parseTime(p.from),
      to: parseTime(p.to),
      on: p.on.map((r) => roles[r]),
    }));
    const outfield = letters.map((r) => roles[r]);
    const players = [
      { id: keeper, gk: true, stints: [{ from: 0, to: MATCH_MS }], total: MATCH_MS },
      ...outfield.map((id, i) => {
        const stints = stintsOf(periods, id);
        return { id, role: letters[i], gk: false, stints, total: sumStints(stints) };
      }),
    ];
    return { size, keeper, outfield, periods, stoppages: stoppagesOf(periods), players };
  }

  /* ---------------------------------------------------------------- */
  /* Live match clock                                                  */
  /* ---------------------------------------------------------------- */

  /**
   * Match time is derived from the stored kickoff timestamp, never counted:
   *   (now - kickoff - total paused) * speed, clamped to 0..38:00.
   */
  function matchTime(m, now) {
    const pausedNow = m.paused && m.pausedAt != null ? Math.max(0, now - m.pausedAt) : 0;
    const real = now - m.kickoffAt - (m.pausedTotal || 0) - pausedNow;
    return Math.min(MATCH_MS, Math.max(0, real * (m.speed || 1)));
  }

  /**
   * How long the red SUB screen stays up before it counts as DONE, in match ms.
   * Test mode keeps it up for 5 real seconds; measuring that in match time
   * (5 s x speed) means pausing freezes this countdown too.
   */
  function subScreenMs(m) {
    const speed = m.speed || 1;
    return speed > 1 ? TEST_SUB_SCREEN_REAL_MS * speed : SUB_SCREEN_MS;
  }

  /**
   * Stoppages confirmed by match time t, including any red SUB screen that has
   * been up for its full window (auto-DONE). Pure: derived only from the stored
   * state, so a reload mid-sub lands in the right place.
   *   confirmedAt: match time of the most recent confirmation (DONE or auto).
   * A red screen starts at its planned time, or when the previous stoppage was
   * confirmed if that was later.
   */
  function settle(m, t) {
    const stops = m.plan.stoppages;
    const win = subScreenMs(m);
    let idx = Math.min(m.confirmed || 0, stops.length);
    let confirmedAt = m.confirmedAt || 0;
    while (idx < stops.length) {
      const shownAt = Math.max(stops[idx].at, confirmedAt);
      if (t < shownAt + win) break;
      confirmedAt = shownAt + win;
      idx++;
    }
    return { idx, confirmedAt };
  }

  /**
   * What the live screen should show.
   *   mode:    normal | warn | sub | full
   *   idx:     index of the next unconfirmed stoppage (= stoppages confirmed so far)
   *   subLeft: in "sub", match ms until the red screen auto-closes as DONE
   * Stoppages always fire at their planned match time, so a late DONE never
   * shifts the schedule.
   */
  function liveStatus(m, now) {
    const t = matchTime(m, now);
    const stops = m.plan.stoppages;
    const { idx, confirmedAt } = settle(m, t);
    const next = stops[idx] || null;
    let mode = "normal";
    let subLeft = 0;
    if (t >= MATCH_MS) mode = "full";
    else if (next && t >= next.at) {
      mode = "sub";
      subLeft = Math.max(next.at, confirmedAt) + subScreenMs(m) - t;
    } else if (next && t >= next.at - WARN_MS) mode = "warn";
    return { mode, t, idx, next, confirmedAt, subLeft };
  }

  return {
    MATCH_MS, WARN_MS, SUB_SCREEN_MS, ON_PITCH, SIZES,
    rolesFor, parseTime, fmtClock, fmtCountdown,
    stoppagesOf, stintsOf,
    validateTemplate, validateTemplates, checkTemplates,
    buildPlan, matchTime, subScreenMs, liveStatus,
  };
});
