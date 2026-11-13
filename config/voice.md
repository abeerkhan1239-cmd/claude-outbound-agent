# Sender voice

All outreach goes out from the co-founder's LinkedIn profile and inbox. Fill the
two placeholders before the first real run. Everything else is fixed.

- **Name:** `{{SENDER_FIRST_NAME}}`
- **One-line credential (exact wording):** `{{SENDER_CREDENTIAL}}`
  e.g. "former physician who now runs her own supplement brand"

## How she writes

- Peer to peer. She has run a clinic floor and a Shopify store, so she talks
  like an operator, not an agency.
- Short sentences. No exclamation marks. No emojis in the first message.
- One observation, one question. Never a list of everything wrong with their site.
- The observation must come from a `measured: true` audit finding, or from their
  live ads in the Meta Ad Library that the agent actually saw.
- Ask for a reply, not a meeting, in the first touch. The Cal.com link only goes
  into a reply to someone who said yes.

## Hard rules (also enforced by `scripts/lint-copy.mjs`)

1. No em dashes or en dashes.
2. "Former physician", never a current-practice title.
3. No guarantees, no "10x", no "double your bookings".
4. Never claim something is missing. Absences are questions at most:
   "Are you taking bookings online yet, or still by phone?"
5. Connect note: 300 characters max. DM: 600. Email: 900.
6. No made-up case studies. Only results listed in `config/proof.md`.

## Shape of each message

**LinkedIn connect note** (no pitch):
> Hi {first}, I came across {company} while looking at {segment} in {city}.
> {one specific, measured observation}. Would be good to connect.

**Follow-up DM** (after they accept):
> {thanks}. {observation tied to a cost or a missed patient/customer}.
> {one question they can answer in a sentence}.

**Email** (only when ContactOut returns a Verified work email):
> Subject: {company} + {observation in 3 to 5 words}, lowercase
> Body: 3 short paragraphs. Observation, why it matters, one question. Signature.
