# WALL RUSH

*by Zondi* · part of the Indigenous Games System

A strategy game of paths and barriers. Reach the far edge before your rival does, and build walls to slow them down.
Modes: two-player, four-player local, vs Computer (Advanced and Expert), interactive lessons and a practice board.

> **Status notes (please read)**
> - **The ruleset is PROVISIONAL.** No official Wall Rush rules were available when this was built. The values live in one place, `RULES` in `src/rules/engine.js`, and the game labels them as provisional on the Rules page. Replace them with the official rules when available, then update the Rules and Learn text to match.
> - **The Heritage "Documented history" section is intentionally empty** and marked "needs verified sources". Add only verified entries, with sources, to `src/config.js`.
> - **Internet multiplayer is disabled until you configure it.** Out of the box the Online screen offers only a clearly labelled **Same-device test** (two tabs of one browser). To enable internet play, add your Supabase project URL and public key in `src/config.js` (see "Internet play with Supabase" below). Until then it stays off.

## Run it

It is a static site: plain HTML, CSS and JavaScript. No Node, npm, bundler or build step.

```
# option 1: just open index.html in a browser
# option 2: serve the folder (any static server works)
python3 -m http.server 8080      # then open http://localhost:8080
```

## Deploy it

Upload the contents of this folder (everything except `tests/`, which is optional) to any static host: GitHub Pages, Netlify, Cloudflare Pages, Vercel (static), an S3 bucket, or a plain web server such as nginx or Apache.

- All paths are **relative**, so it works at a domain root or in a sub-folder (for example `https://your-domain/games/wall-rush/`).
- The game is a single page and never changes the URL, so no rewrite or fallback rules are needed.
- It must be served over **HTTPS** for the best experience (sound unlock, clipboard copy, and a future secure WebSocket).
- Optional: self-host the two fonts (Big Shoulders Display, Instrument Sans) and remove the Google Fonts links in `index.html`. Until then the game uses system fonts if Google Fonts is unreachable.

## Configuration

Edit `src/config.js` only. It is public, so **never put secrets in it**.

| Setting | Purpose |
| --- | --- |
| `WR_CONFIG.online.endpoint` | WebSocket relay address for internet multiplayer, for example `wss://example.org/wallrush`. Empty means internet play stays disabled. |
| `WR_CONFIG.heritage.documented` | Verified history entries: `{ title, text, source }`. Empty means the "needs verified sources" notice is shown. |
| `WR_CONFIG.heritage.interpretation` / `.system` | Interpretation and Indigenous Games System text. |

No environment variables, so there is no `.env` file.

### Internet play with Supabase (optional)

Vercel (or any static host) serves the game; Supabase Realtime Broadcast relays the moves. No database tables and no server code are needed.

1. Create a Supabase project. In **Project Settings → API**, copy the Project URL and the public `anon` / publishable key. Never use the `service_role` or secret key.
2. In the dashboard open **Realtime → Settings** and turn on **Allow public access** (this game uses public channels, with no sign-in).
3. Put the URL and public key in `src/config.js` under `online.supabase`, then redeploy.
4. Open the game on two devices, choose Online, create a room on one and join with the code on the other.

Limits and risks: the free plan allows 200 concurrent connections and 100 messages per second. Anyone who knows a room code can try to join it, and a stranger who joined could send moves as the opponent. Both sides validate every move against the rules, so illegal moves are rejected, but this is not hardened against deliberate abuse. See the setup notes in the project chat or add private channels with anonymous sign-in before public launch. `tests/e2e/06-internet-supabase-mock.py` tests the connector with a stand-in library; it cannot prove your own project is configured correctly.

### Relay protocol (for a custom WebSocket server instead)

The client opens `endpoint?room=CODE` and sends JSON messages. A relay only has to forward every message it receives to the other connection(s) in the same room. Both clients check every move with the same rules engine, so the server does not need game logic. Message types: `join`, `welcome`, `full`, `move`, `ping`, `leave`, `rematch`. Add authentication, rate limits and room expiry on the server before exposing it publicly.

## Project layout

```
index.html            page shell and script order
favicon.svg
css/style.css         visual identity, themes, responsive layout
src/config.js         deployment settings and heritage text (edit this)
src/rules/engine.js   rules and move validation (pure logic, RULES live here)
src/ai/ai.js          Advanced and Expert opponents
src/core/core.js      settings, storage, sound, player artwork, statistics
src/online/room.js    room client, same-device and WebSocket transports
src/online/supabase-transport.js  optional Supabase Realtime transport (inactive until configured)
src/ui/board.js       SVG board renderer
src/ui/controllers.js match controller (AI, local, online, practice)
src/ui/lessons.js     interactive lessons
src/ui/screens.js     menu, setup, learn, rules, heritage, stats, settings, router
src/main.js           starts the app
tests/                regression tests (optional)
```

Scripts are classic (non-module) scripts that share one global scope and load in the order listed in `index.html`. Keep that order if you add files.

## Tests (optional)

```
node tests/engine.test.js                    # rules, turn order, wall legality, 2p and 4p random-play checks
node tests/ai-vs-racer.js                    # AI strength against a wall-less racer
node tests/ai-expert-vs-advanced.js          # Expert vs Advanced
python3 tests/e2e/01-core-flows.py           # needs: pip install playwright && playwright install chromium
python3 tests/e2e/06-internet-supabase-mock.py   # internet-play wiring with a stand-in Supabase library
```

The `tests/e2e` scripts drive a real browser through menus, matches, lessons, four-player play, touch and mobile layouts, and the same-device online flow. Set `WR_URL` to test a deployed address.

## Data stored in the browser

`localStorage` keys: `wr.settings.v1`, `wr.stats.v1`, `wr.learn.v1`, `wr.lastLevel`, `wr.name`. Nothing is sent anywhere. Same-device test matches are not added to statistics.

## Accessibility

Keyboard play (arrows, R to rotate, Enter to place), screen-reader announcements, focus outlines, shape and symbol identity for every player (never colour alone), reduced-motion and high-contrast settings, larger-text option, and 44px minimum controls (board tiles are smaller on narrow phones).
