#!/usr/bin/env node
/**
 * Guardrail check for drafted outreach. The agent runs this on every draft
 * before it is saved; a draft that fails is rewritten, never shipped.
 *
 *   node scripts/lint-copy.mjs <channel> <file-with-draft-text>
 *   channel: connect | dm | email
 *
 * Exit 0 = clean, exit 1 = problems (listed as JSON on stdout).
 */
import { readFileSync } from "node:fs";

const LIMITS = { connect: 300, dm: 600, email: 900 };

const RULES = [
  // House style: em/en dashes read as machine-written in a cold message.
  [/[—–]/, "contains an em or en dash"],
  // Credential accuracy: the sender is a former physician, not practising.
  [/\b(?:i am|i'm) a (?:doctor|physician)\b|\bpracticing (?:doctor|physician)\b/i, "describes the sender as a current doctor (use 'former physician')"],
  // Claims about results that we cannot back up with a case study.
  [/\bguarantee[sd]?\b|\b\d{2,}x\b|\bdouble your\b|\btriple your\b/i, "makes a guarantee or multiplier claim"],
  // Typical AI filler that kills reply rates.
  [/\bI hope this (?:email|message) finds you\b|\bin today's (?:fast-paced|digital)\b|\bunlock\b|\bleverage\b|\bsynerg/i, "uses filler phrasing"],
  // Assertions of absence belong to unmeasured findings and are never sent.
  [/\byou (?:don't|do not) have\b|\byou(?:'re| are) not (?:tracking|running)\b|\byour site (?:has no|lacks)\b/i, "asserts something is missing (absences are never claims)"],
];

const [channel, file] = process.argv.slice(2);
if (!LIMITS[channel] || !file) {
  process.stderr.write("usage: node scripts/lint-copy.mjs <connect|dm|email> <file>\n");
  process.exit(2);
}

const draft = readFileSync(file, "utf8").trim();
const problems = RULES.filter(([re]) => re.test(draft)).map(([, msg]) => msg);
if (draft.length > LIMITS[channel]) problems.push(`${draft.length} characters, limit for ${channel} is ${LIMITS[channel]}`);
if ((draft.match(/\?/g) ?? []).length > 2) problems.push("more than two questions");

console.log(JSON.stringify({ channel, length: draft.length, ok: problems.length === 0, problems }, null, 2));
process.exit(problems.length ? 1 : 0);
