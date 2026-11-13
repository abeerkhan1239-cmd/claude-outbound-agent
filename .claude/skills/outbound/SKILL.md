---
name: outbound
description: Adcelerate's outbound agent. Reads new leads from the Leads Google Sheet, finds the decision maker with ContactOut, audits their website, drafts a LinkedIn connect note, DM and email in the co-founder's voice, saves email drafts to Gmail, and triages replies. Use when the user says "outbound", "run outbound", "process new leads", "draft outreach", or "check replies".
---

# Outbound agent

Pipeline per lead: **Sheet row → ContactOut → site audit → draft → lint → Gmail draft + sheet → (later) reply triage.**
Nothing is ever sent. Every message waits for a person.

Project folder (all paths below are relative to it): the directory that contains this
`.claude/` folder. Run scripts with `node scripts/<name>.mjs`.

## Before anything

1. Read `config/voice.md`, `config/icp.md`, `config/proof.md`. If `voice.md` still has
   `{{SENDER_FIRST_NAME}}`, stop and ask for the sender's name and credential line.
2. `LEADS_SHEET_ID` comes from `.env`. Read the `Leads` tab with the Google Sheets tool.
   Column layout: `config/sheet-schema.md`.
3. `node scripts/contactout.mjs stats` once. If credits are low, say how many leads that
   covers and process only that many.

## Modes

- **`/outbound`** or "process new leads": rows with `status = new` (max 15 per run).
- **"check replies"**: reply triage only (step 6).
- **"outbound <company>"**: just that row, any status.

## Steps for each lead

1. **ICP check.** Against `config/icp.md`. Not a fit → `status = skip`, reason in `notes`, next lead.
2. **Decision maker.** `node scripts/contactout.mjs decision-makers <website>`.
   Pick ONE person by the priority in `icp.md`. Nobody fits → `notes = "no decision maker found"`, keep
   `status = new`, next lead. Then `node scripts/contactout.mjs contact <their linkedin>`.
   Use the email only if its status is `Verified`.
3. **Audit.** `node scripts/audit.mjs <website>`. Keep findings with `measured: true`.
   For `segment = brand`, also open the returned `meta_ad_library` URL in the built-in browser
   and note whether active ads exist and roughly how many (read the page text, no screenshots).
   Unreachable site → `notes`, skip drafting.
4. **Draft** three texts following `config/voice.md`: connect note, DM, email (email only with
   a Verified address). Use exactly one measured finding as the hook. Write each draft to a temp
   file and run `node scripts/lint-copy.mjs <connect|dm|email> <file>`. Rewrite until it passes.
   Never weaken a rule to make a draft pass.
5. **Save.**
   - Email → `create_draft` in Gmail (to the Verified address). Never `send_message`.
   - Sheet: fill G to P, `status = drafted`, `last_touch = today`.
6. **Reply triage** ("check replies", and at the end of every run). Search Gmail for replies
   from addresses in column J in the last 14 days. Classify as `interested`, `not_now`,
   `wrong_person` or `unsubscribe` and write it to `reply_status`, `status = replied`.
   - `interested`: draft a reply (Gmail `create_draft`, in-thread) with one line of thanks and the
     Cal.com link from `.env` `CAL_LINK`.
   - `wrong_person`: if they named someone, put the name in `notes`.
   - `unsubscribe`: `status = closed`, no draft, never contact again.

## End of run

Print a short summary: leads processed, skipped (why), drafts created, replies by class,
ContactOut credits used. Then remind the user to log review time:
`node scripts/timelog.mjs agent <minutes> <company>`.

## Never

- Send any email or LinkedIn message, or set `status = sent`.
- Reveal contact info for more than one person per company.
- Put an unmeasured finding (an absence) into a message as a fact.
- Cite a result that is not in `config/proof.md`.
- Write the ContactOut key, emails or names anywhere outside the sheet and Gmail drafts.
