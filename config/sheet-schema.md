# Leads sheet

One Google Sheet, tab `Leads`, row 1 = these headers in this order. You fill the
first five columns; the agent fills the rest and only ever moves `status` forward.

| Col | Header | Who fills it | Notes |
|---|---|---|---|
| A | company | you | |
| B | website | you | domain is enough |
| C | segment | you | `clinic` or `brand` |
| D | city | you | blank for brands |
| E | source | you | Prospector, Sales Nav, Google Maps, referral |
| F | status | agent | `new` → `researched` → `drafted` → `sent` → `replied` → `booked` / `closed` / `skip` |
| G | dm_name | agent | decision maker |
| H | dm_title | agent | |
| I | dm_linkedin | agent | |
| J | email | agent | only a Verified work email |
| K | findings | agent | measured findings only, `; ` separated |
| L | connect_note | agent | ≤ 300 chars, paste into LinkedIn |
| M | dm_text | agent | send after they accept |
| N | email_draft | agent | `Gmail draft` when a draft was created |
| O | reply_status | agent | `interested`, `not_now`, `wrong_person`, `unsubscribe` |
| P | last_touch | agent | YYYY-MM-DD |
| Q | notes | both | |

`status = sent` is set by a person, never by the agent. The agent does not know
whether a LinkedIn message actually went out.
