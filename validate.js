#!/usr/bin/env node
/* Checks templates.js from the command line:  node validate.js */
const TEMPLATES = require("./templates.js");
const Logic = require("./logic.js");

const errs = Logic.checkTemplates(TEMPLATES);

for (const size of Logic.SIZES) {
  const tpl = TEMPLATES[size];
  if (!tpl || Logic.validateTemplate(size, tpl).length) continue;
  const roles = Object.fromEntries(Logic.rolesFor(size).map((r) => [r, r]));
  const plan = Logic.buildPlan(size, "GK", roles, tpl);
  console.log(`\n${size} players`);
  for (const s of plan.stoppages) {
    console.log(`  ${Logic.fmtClock(s.at)}  OFF ${s.off.join(" ").padEnd(6)}  ON ${s.on.join(" ")}`);
  }
  console.log("  " + plan.players.map((p) => `${p.id} ${p.total / 60000}`).join(", "));
}

process.exit(errs.length ? 1 : 0);
