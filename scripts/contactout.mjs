#!/usr/bin/env node
/**
 * ContactOut enrichment CLI. Zero dependencies (Node 18+ fetch).
 *
 *   node scripts/contactout.mjs decision-makers <domain>       # who runs the company (no contact reveal)
 *   node scripts/contactout.mjs contact <linkedin-profile-url> # work email for ONE chosen person
 *   node scripts/contactout.mjs enrich <linkedin-profile-url>  # full profile (headline, experience)
 *   node scripts/contactout.mjs stats                          # credits used this month
 *
 * Credit discipline is the point of the split: `decision-makers` runs without
 * reveal_info, so it spends search credits only. Email credits are spent in
 * `contact`, for the one person the agent actually picked.
 *
 * Output is always JSON on stdout, so the Claude Code skill can parse it.
 * Errors go to stderr with a non-zero exit code.
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = "https://api.contactout.com";

function loadEnv() {
  const file = join(ROOT, ".env");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

function fail(msg, code = 1) {
  process.stderr.write(`contactout: ${msg}\n`);
  process.exit(code);
}

/** The documented error table, so the skill can tell "out of credits" from "bad URL". */
const ERRORS = {
  400: "bad credentials or invalid headers (check CONTACTOUT_API_KEY)",
  401: "bad request or invalid input",
  403: "out of credits, or this plan has no access to the endpoint",
  429: "rate limit reached",
};

async function call(path, { method = "GET", body } = {}) {
  const token = process.env.CONTACTOUT_API_KEY;
  if (!token) fail("CONTACTOUT_API_KEY is not set (copy .env.example to .env)");
  const res = await fetch(BASE + path, {
    method,
    headers: {
      token,
      authorization: "basic",
      accept: "application/json",
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    const retry = res.headers.get("retry-after");
    fail(`${res.status} ${ERRORS[res.status] ?? ""}${retry ? ` (retry after ${retry}s)` : ""}: ${text.slice(0, 300)}`, 2);
  }
  try {
    return JSON.parse(text);
  } catch {
    fail(`non-JSON response: ${text.slice(0, 200)}`, 2);
  }
}

function cleanDomain(input) {
  return input
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .split(/[/?#]/)[0]
    .toLowerCase();
}

function requireProfile(url) {
  if (!url || !/^https?:\/\/.*linkedin\.com\/(in|pub)\//i.test(url)) {
    fail("expected a LinkedIn profile URL like https://www.linkedin.com/in/someone");
  }
  return url;
}

/** Keep only what the outreach step needs; the raw payloads are large. */
function slimPerson(p) {
  return {
    name: p.full_name ?? p.fullName ?? p.name,
    title: p.title ?? p.headline,
    linkedin: p.li_vanity ? `https://www.linkedin.com/in/${p.li_vanity}` : (p.linkedinUrl ?? p.url),
    seniority: p.seniority,
    job_function: p.job_function ?? p.jobFunction,
    location: p.location,
    has_work_email: p.contact_availability?.work_email ?? null,
  };
}

const [cmd, arg] = process.argv.slice(2);
loadEnv();

switch (cmd) {
  case "decision-makers": {
    if (!arg) fail("usage: decision-makers <domain>");
    const domain = cleanDomain(arg);
    const data = await call(`/v1/people/decision-makers?domain=${encodeURIComponent(domain)}&reveal_info=false`);
    const profiles = data.profiles ?? {};
    const list = (Array.isArray(profiles) ? profiles : Object.entries(profiles).map(([url, p]) => ({ url, ...p })))
      .map((p) => ({ ...slimPerson(p), linkedin: p.url ?? slimPerson(p).linkedin }));
    console.log(JSON.stringify({ domain, count: list.length, people: list }, null, 2));
    break;
  }
  case "contact": {
    const profile = requireProfile(arg);
    const data = await call(`/v1/people/linkedin?profile=${encodeURIComponent(profile)}&email_type=work&include_phone=false`);
    const p = data.profile ?? {};
    const status = p.work_email_status ?? {};
    const emails = (p.work_email ?? []).map((e) => ({ email: e, status: status[e] ?? "unknown" }));
    // Verified first: the skill only drafts an email when the top address is Verified.
    emails.sort((a, b) => (b.status === "Verified") - (a.status === "Verified"));
    console.log(JSON.stringify({ linkedin: profile, work_emails: emails }, null, 2));
    break;
  }
  case "enrich": {
    const profile = requireProfile(arg);
    const data = await call(`/v1/people/enrich`, { method: "POST", body: { linkedin_url: profile } });
    const p = data.profile ?? {};
    console.log(
      JSON.stringify(
        {
          name: p.fullName,
          headline: p.headline,
          company: p.company?.name,
          location: p.location,
          summary: p.summary,
          experience: (p.experience ?? []).slice(0, 4),
        },
        null,
        2,
      ),
    );
    break;
  }
  case "stats": {
    console.log(JSON.stringify(await call(`/v1/stats`), null, 2));
    break;
  }
  default:
    fail("commands: decision-makers <domain> | contact <linkedin-url> | enrich <linkedin-url> | stats");
}
