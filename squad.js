/*
 * DEFAULT SQUAD — plain data, safe to edit.
 *
 * Loaded automatically on a device that has no saved squad yet, and again
 * whenever "Reset to default squad" is tapped on the Squad screen.
 * A device that already has its own saved squad keeps it.
 *
 * One name per line, in quotes, followed by a comma.
 */
const DEFAULT_SQUAD = [
  "Beau",
  "Bryan",
  "Dimi",
  "Fin",
  "Isaac",
  "Jack",
  "JT",
  "Leo",
  "Luke",
  "Matt",
  "Mika",
  "Ollie",
  "Oscar",
  "Ralph",
  "Toby",
];

if (typeof module === "object" && module.exports) module.exports = DEFAULT_SQUAD;
