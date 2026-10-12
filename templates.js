/*
 * ROTATION TEMPLATES — plain data, safe to edit.
 *
 * Key = players attending (including the goalkeeper).
 * Outfield roles are letters:
 *   A B C D = the starting four, in the order tapped at setup.
 *   E F G   = the subs, in bench order.
 * The goalkeeper is never listed: they play the full 38:00.
 *
 * Each period lists the 4 outfield roles on the pitch. Periods must run
 * back-to-back from "00:00" to "38:00". Stoppages (who goes OFF / ON) are
 * worked out automatically from the change between consecutive periods.
 *
 * "expected" is each role's total minutes. The app checks the periods
 * against these numbers at startup (see validateTemplates in logic.js),
 * and you can run the same check with:  node validate.js
 */
const TEMPLATES = {
  6: {
    periods: [
      { from: "00:00", to: "08:00", on: ["A", "B", "C", "D"] },
      { from: "08:00", to: "15:00", on: ["B", "C", "D", "E"] },
      { from: "15:00", to: "23:00", on: ["C", "D", "E", "A"] },
      { from: "23:00", to: "30:00", on: ["D", "E", "A", "B"] },
      { from: "30:00", to: "38:00", on: ["E", "A", "B", "C"] },
    ],
    expected: { A: 31, B: 30, C: 31, D: 30, E: 30 },
  },

  7: {
    periods: [
      { from: "00:00", to: "08:00", on: ["A", "B", "C", "D"] },
      { from: "08:00", to: "13:00", on: ["C", "D", "E", "F"] },
      { from: "13:00", to: "25:00", on: ["E", "F", "A", "B"] },
      { from: "25:00", to: "30:00", on: ["A", "B", "C", "D"] },
      { from: "30:00", to: "38:00", on: ["C", "D", "E", "F"] },
    ],
    expected: { A: 25, B: 25, C: 26, D: 26, E: 25, F: 25 },
  },

  8: {
    periods: [
      { from: "00:00", to: "06:00", on: ["A", "B", "C", "D"] },
      { from: "06:00", to: "16:00", on: ["D", "E", "F", "G"] },
      { from: "16:00", to: "22:00", on: ["E", "F", "A", "B"] },
      { from: "22:00", to: "32:00", on: ["A", "B", "G", "C"] },
      { from: "32:00", to: "38:00", on: ["C", "E", "F", "D"] },
    ],
    expected: { A: 22, B: 22, C: 22, D: 22, E: 22, F: 22, G: 20 },
  },
};

if (typeof module === "object" && module.exports) module.exports = TEMPLATES;
