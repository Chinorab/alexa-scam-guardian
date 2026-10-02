# Contract: Web App (simulated Echo, family page, reply page)

All routes served by one Hono app. JSON routes under `/api`. Pages are server rendered.

## Simulated Echo API

### `POST /api/device/start`

Starts a device session. Signed in organizers get their household; others get a fresh
private demo household (24 h TTL).

- **Response**: `deviceId`, `householdKind` (`real` or `demo`), `olderAdultFirstName`

### `POST /api/converse`

One turn of the conversation.

- **Request**: `deviceId`, `text` (final transcript or typed), `isRepeat?` (bool)
- **Response**:
  - `say` (string, passed the output guard), `rate` (`normal` or `slow`)
  - `mode` (`full` or `simplified`)
  - `uiResources[]` (`uri`, `html`, `data`) to render as MCP Apps views
  - `expectReply` (bool, keeps the microphone open)
  - `light` (`idle`, `listening`, `thinking`, `speaking`, `notification`)
- **Timing**: if the full mode has no answer after 3 s, the simplified mode answers (FR-036).

### `POST /api/interim`

Interim speech text while the older adult is still talking.

- **Request**: `deviceId`, `partialText`
- **Response**: `interrupt` (bool), `say?` (the fixed stop phrase when a sensitive number
  starts)

### `POST /api/tts`

- **Request**: `text`, `rate`
- **Response**: `audio/mpeg` (Polly). Clients fall back to browser speech on failure.

### `GET /api/device/:deviceId/events`

Polled every 3 s. **Response**: `unread` (int), `light` (`notification` when unread > 0),
`chime` (bool, true once per new event). Content is only spoken after "What's new?".

### `GET /api/device/:deviceId/demo-phone`

Messages sent to `text` channel members of this household, newest first, each with its reply
link. Used by the on screen demo phone.

### `POST /api/demo/reset`

Reseeds the visitor's demo household.

## Reply page (relatives)

- `GET /r/:token`: page with the check message, two large buttons "It was me" and
  "It wasn't me", and "Call them on the number you know" guidance.
- `POST /r/:token` with `answer`: records one reply, then shows a thank you page.
- `GET /stop/:token`: opts the member out of all messages.

## Family page

- `GET /family/sign-in`, `POST /family/sign-in` (email) sends a single use link.
- `GET /family/sign-in/:token` sets the session cookie and redirects to `/family`.
- `GET /family`: household overview.
- `POST /family/members`, `POST /family/members/:id`, `POST /family/members/:id/delete`
- `POST /family/members/:id/test`: sends a test message (rate limited).
- `POST /family/password`, `POST /family/password/delete`
- `POST /family/settings` (first name, wait time)
- `GET /family/activity`: recent checks with report summaries.
- `POST /family/delete-all`: requires typing the older adult's first name to confirm.
- `POST /family/sign-out`

Forms work without JavaScript. Every response sets a strict Content Security Policy.

## Static pages

- `GET /` home (what it does, try the demo, family sign in)
- `GET /privacy` privacy page (FR-033)
- `GET /echo` simulated Echo client
- `/favicon.svg`, `/favicon.ico`
