#!/usr/bin/env node
/**
 * Funnel audit for one prospect website. Zero dependencies.
 *
 *   node scripts/audit.mjs <url-or-domain>
 *
 * Prints JSON. Every finding is tagged:
 *   measured: true  -> seen in the page (a booking vendor, a pixel, an offer line).
 *                      Safe to mention in outreach.
 *   measured: false -> an ABSENCE in static HTML. Wix/Squarespace inject tags at
 *                      runtime, so "no pixel found" can be wrong. Never put these
 *                      in a message as a claim; at most ask about them.
 *
 * One wrong claim in a cold email ("you don't have online booking" when they do)
 * ends the conversation, so this split is the main safety rule of the agent.
 *
 * Ported and trimmed from the Adcelerate Prospector audit (TypeScript).
 */

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const TIMEOUT_MS = 15_000;

const BOOKING = [
  ["Boulevard", /joinblvd\.com|blvd\.co\//i],
  ["Zenoti", /zenoti\.com/i],
  ["Vagaro", /vagaro\.com/i],
  ["Mindbody", /mindbodyonline\.com/i],
  ["Jane", /janeapp\.com/i],
  ["NexHealth", /nexhealth\.com/i],
  ["LocalMed", /localmed\.com/i],
  ["Zocdoc", /zocdoc\.com/i],
  ["Acuity", /acuityscheduling\.com|squarespacescheduling\.com/i],
  ["Calendly", /calendly\.com/i],
  ["Square Appointments", /squareup\.com\/appointments/i],
];

const PLATFORMS = [
  ["Shopify", /cdn\.shopify\.com/i],
  ["WordPress", /wp-content|wp-includes/i],
  ["Wix", /static\.wixstatic\.com/i],
  ["Squarespace", /static1\.squarespace\.com/i],
  ["Webflow", /webflow\.com|wf-domain/i],
  ["GoDaddy", /img1\.wsimg\.com/i],
];

const TRACKING = [
  ["Meta Pixel", /connect\.facebook\.net\/[^"']*fbevents\.js|fbq\(\s*['"]init/i],
  ["Google Tag Manager", /googletagmanager\.com\/gtm\.js|GTM-[A-Z0-9]{4,}/i],
  ["Google Ads tag", /AW-\d{6,}/],
  ["GA4", /G-[A-Z0-9]{6,}/],
  ["TikTok Pixel", /analytics\.tiktok\.com/i],
  ["Klaviyo", /klaviyo\.com/i],
];

const OFFERS = [
  ["new patient / first order offer", /new[\s-]?(?:patient|client|customer)s?[\s-]?(?:special|offer|discount)|first[\s-]order/i],
  ["free consultation", /free\s+(?:consultation|consult|exam|assessment)/i],
  ["discount", /\$\s?\d{2,4}\s*off|\d{1,2}%\s*off/i],
  ["subscribe & save", /subscribe\s*(?:&|and)\s*save/i],
  ["financing", /financing|cherry|carecredit|afterpay|klarna/i],
];

function normalise(input) {
  const raw = (input || "").trim();
  if (!raw) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    return u.hostname.includes(".") ? u.toString() : null;
  } catch {
    return null;
  }
}

async function get(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: { "user-agent": UA, accept: "text/html" }, redirect: "follow", signal: ctrl.signal });
    return { res, html: await res.text() };
  } catch (e) {
    return { error: e.name === "AbortError" ? `no response in ${TIMEOUT_MS / 1000}s` : e.message };
  } finally {
    clearTimeout(t);
  }
}

const text = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");

const url = normalise(process.argv[2]);
if (!url) {
  process.stderr.write("usage: node scripts/audit.mjs <url-or-domain>\n");
  process.exit(1);
}

let r = await get(url);
// Many small-business apex domains do not resolve while www. does. Without this
// retry a live site is recorded as "unreachable", and that false claim could
// reach an email.
if (r.error && !/^https?:\/\/www\./i.test(url)) r = await get(url.replace(/^(https?:\/\/)/i, "$1www."));

if (r.error || !r.res?.ok) {
  console.log(JSON.stringify({ url, reachable: false, error: r.error ?? `HTTP ${r.res?.status}`, findings: [] }, null, 2));
  process.exit(0);
}

const html = r.html;
const body = text(html);
const findings = [];
const add = (area, finding, measured, evidence) => findings.push({ area, finding, measured, ...(evidence ? { evidence } : {}) });

const platform = PLATFORMS.find(([, re]) => re.test(html))?.[0] ?? "unknown";
add("platform", `Site runs on ${platform}`, platform !== "unknown");

const booking = BOOKING.find(([, re]) => re.test(html));
if (booking) add("booking", `Online booking via ${booking[0]}`, true);
else if (/href=["'][^"']*(book|schedule|appointment)[^"']*["']/i.test(html)) add("booking", "Has a self-hosted book/schedule link", true);
else add("booking", "No booking link found in page source", false);

for (const [name, re] of TRACKING) {
  if (re.test(html)) add("tracking", `${name} installed`, true);
}
if (!TRACKING.some(([n, re]) => n === "Meta Pixel" && re.test(html))) add("tracking", "No Meta Pixel found in page source", false);

const offers = OFFERS.filter(([, re]) => re.test(body)).map(([n]) => n);
if (offers.length) add("offer", `Visible offer: ${offers.join(", ")}`, true);
else add("offer", "No visible offer or promotion on the homepage", false);

const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim();
const ig = html.match(/instagram\.com\/([A-Za-z0-9_.]+)/i)?.[1];
const host = new URL(r.res.url).hostname.replace(/^www\./, "");

console.log(
  JSON.stringify(
    {
      url: r.res.url,
      reachable: true,
      title,
      platform,
      instagram: ig && !/^(p|reel|explore)$/i.test(ig) ? ig : null,
      // Ad activity is checked by the agent in the browser, not here: the Ad
      // Library is a JS app and has no public endpoint for commercial ads.
      meta_ad_library: `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&q=${encodeURIComponent(host)}`,
      findings,
    },
    null,
    2,
  ),
);
