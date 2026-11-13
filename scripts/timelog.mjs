#!/usr/bin/env node
/**
 * Time-saved log. This is what turns "saves ~10 hrs/week" from a guess into a
 * number you can defend.
 *
 *   node scripts/timelog.mjs baseline <minutes> <company>   # a lead done fully by hand (stopwatch)
 *   node scripts/timelog.mjs agent <minutes> <company>      # a lead done with the agent (your review time)
 *   node scripts/timelog.mjs report [days=7]                # averages and hours saved
 *
 * Data lives in data/time-log.csv (gitignored: it names real prospects).
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const FILE = join(dirname(fileURLToPath(import.meta.url)), "..", "data", "time-log.csv");
const [cmd, a, ...rest] = process.argv.slice(2);

if (cmd === "baseline" || cmd === "agent") {
  const minutes = Number(a);
  if (!Number.isFinite(minutes) || minutes <= 0) {
    process.stderr.write("minutes must be a positive number\n");
    process.exit(1);
  }
  mkdirSync(dirname(FILE), { recursive: true });
  if (!existsSync(FILE)) appendFileSync(FILE, "date,mode,minutes,company\n");
  const company = rest.join(" ").replace(/[",\n]/g, " ").trim();
  appendFileSync(FILE, `${new Date().toISOString().slice(0, 10)},${cmd},${minutes},${company}\n`);
  console.log(JSON.stringify({ logged: { mode: cmd, minutes, company } }));
} else if (cmd === "report") {
  const days = Number(a ?? 7);
  const since = new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);
  const rows = existsSync(FILE)
    ? readFileSync(FILE, "utf8").trim().split("\n").slice(1).map((l) => l.split(","))
    : [];
  const all = rows.map(([date, mode, m]) => ({ date, mode, m: Number(m) }));
  const avg = (mode) => {
    const xs = all.filter((r) => r.mode === mode).map((r) => r.m);
    return xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null;
  };
  const base = avg("baseline");
  const agent = avg("agent");
  const recent = all.filter((r) => r.mode === "agent" && r.date >= since).length;
  const saved = base != null && agent != null ? ((base - agent) * recent) / 60 : null;
  console.log(
    JSON.stringify(
      {
        window_days: days,
        baseline_min_per_lead: base && +base.toFixed(1),
        agent_min_per_lead: agent && +agent.toFixed(1),
        leads_with_agent: recent,
        hours_saved: saved && +saved.toFixed(1),
        note: base == null ? "log at least 5 baseline leads by hand first" : undefined,
      },
      null,
      2,
    ),
  );
} else {
  process.stderr.write("commands: baseline <min> <company> | agent <min> <company> | report [days]\n");
  process.exit(1);
}
