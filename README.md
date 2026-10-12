# FC Deadline Day

Substitution manager and match timer for five-a-side: 38:00 matches, a fixed goalkeeper,
6–8 players, four planned stoppages. Plain HTML/CSS/JS with no build step and no backend.
It works offline once installed.

**Live app:** https://vora360creative-lab.github.io/five-a-side-subs/

## Install on iPhone

1. Open the live app in **Safari** (not Chrome).
2. Tap **Share** → **Add to Home Screen** → **Add**. It appears as **Deadline Day** with the
   "DD" icon.
3. Open it from the Home Screen, close it, and open it once more so the offline copy is
   fully saved. From then on it opens with no signal.

If an older version is on your Home Screen (named "Subs"), delete it and add it again.
iPhone keeps the name and icon from when an app was first added. Removing it may also
clear that copy's saved squad, so the squad starts again from the default.

Everything is stored on the phone (squad, setup, a match in progress), separately for
each web address.

## How it works

**Squad.** The saved list of players. Add a name, paste a list (one per line or separated
by commas), tap a name to rename it, or tap ✕ then **Delete**. **Reset to default squad**
at the bottom restores the squad from `squad.js` after a confirmation.

**Match.**
1. Tap who's here (6–8 players; any other number is blocked with a message).
2. Tap the goalkeeper.
3. Tap the starting four in order (badges 1–4).

The rest become the bench in the order shown. Then tap **Generate rotation**.

The share button next to the title sends the app's link (with "Open in Safari, then Share →
Add to Home Screen") through the iPhone share sheet. Where sharing isn't available, it copies
the link and shows "Link copied".

**Rotation.** Shows each stoppage with who goes OFF and ON, and each player's stints and
minutes (the keeper plays 38:00). Tap two players to swap their whole roles, including
the keeper. **Back** returns to setup for late changes. Then:
- **START MATCH** starts the real match.
- **Test run (x20)** plays the same match 20× faster, with a red `TEST x20` label.
  Ending or finishing a test run returns to the same rotation. Adding `?speed=N` to the
  address makes START MATCH run N× faster.

**Live match.**
- **Normal:** a big match timer and "Next sub 16:00 · in 1:28", with the keeper (GK) and
  outfield players on the pitch and the bench below. A green ▲ marks bench players coming
  ON at the next stoppage, and a red ▼ marks players coming OFF. The arrows move on after
  each sub and disappear after the last one.
- **Pause / play** (top corner): the timer freezes in grey and the next-sub line reads
  PAUSED. All countdowns stop until you tap play.
- **30-second warning:** the whole screen turns amber with "SUB IN 0:30" and the OFF/ON
  names.
- **SUB:** the whole screen turns red with the OFF/ON names, and the timer keeps running.
  Tap **DONE** when the swap is made. Otherwise it closes by itself after 30 seconds of
  match time and counts as DONE; the button shows the countdown, e.g. `DONE · 0:24`. In
  test runs it stays up for 5 real seconds instead. A late DONE never moves later subs.
- **Full time** at 38:00: a green FULL TIME screen, then **Finish**.
- **⋯ menu:** End match early, with a confirmation.

Timing is calculated from the kickoff time, not counted, so it stays exact if the phone
sleeps. If the app is closed or reloaded mid-match, it reopens on the live screen at the
right time with the right lineup.

The app asks the iPhone to keep the screen on during a match. If the phone can't, the
live screen says *Set Auto-Lock to Never during the match*.

## Sound

Sound is **always off** when the app opens, after a reload, and at the start of every
match. Tap the speaker on the live screen to turn it on for that match. A short blip
confirms it, and the button stays solid while sound is on. The sounds are:

- 30-second warning: two soft high beeps;
- sub due: the recorded referee whistle (`sounds/whistle.mp3`), once;
- full time: two short whistles, then the full one.

Where Safari supports it, sounds play even when the iPhone is on silent.

The whistle is normalised automatically when the app loads it. Its peak is set to the
warning beep's level (`WARNING_LEVEL` in `sounds.js`), and it is never louder on average
than the beep. To use a different recording, replace `sounds/whistle.mp3` (keep the
name); leading silence is skipped automatically.

## Default squad

`squad.js` holds the default squad. A device with no saved squad loads it automatically on
first open, and a device that already has its own squad keeps it. To pick up edits to
`squad.js` on a device, tap **Reset to default squad**. Players who are in both lists keep
their match-setup selections.

## Editing rotations

Each template in `templates.js` lists periods of four outfield roles. A–D are the
starting four in tap order, and E, F, G are the bench in order. Stoppage OFF/ON lists are
worked out automatically from the change between periods. Keep `expected` in sync with
the minutes, then check:

```bash
node validate.js
```

It checks four things: exactly 4 outfield roles per period; periods running continuously
from 00:00 to 38:00; 152 outfield minutes in total; and each role's minutes matching
`expected`.

The same check runs when the app opens on a development address (localhost, a
`192.168.x.x` / `10.x.x.x` address or `*.local`) or with `?dev` added to the live address.
Failures are logged to the browser console and shown as a red banner in the app. A broken
template is blocked: "Generate rotation" won't run for that player count.

## Publishing changes

The live app is served by GitHub Pages from the `main` branch of
[vora360creative-lab/five-a-side-subs](https://github.com/vora360creative-lab/five-a-side-subs).
After editing, publish from this folder:

```bash
git add -A && git commit -m "Describe the change" && git push
```

The site updates within a minute or two. On the iPhone, open the app once, close it, and
open it again. The service worker downloads every file in the background and swaps them
in together on the next launch. If you add a new file the app loads, add it to `ASSETS`
in `sw.js`.

## Files

| File | What it is |
| --- | --- |
| `index.html`, `styles.css`, `app.js` | The app: screens, storage, live match, wake lock, sound control |
| `logic.js` | Pure rules: stoppages, stints, match clock, auto-DONE, template validation |
| `templates.js` | **Rotation templates as plain data. Edit these.** |
| `squad.js` | **Default squad, one name per line. Edit this.** |
| `sounds.js` | Plays the sounds (Web Audio): synthesised warning beeps, recorded whistle |
| `sounds/whistle.mp3` | Referee whistle recording (trimmed, cached for offline use) |
| `sw.js`, `manifest.json`, `icons/` | Offline support, Home Screen install, "DD" icons |
| `validate.js` | Checks the templates from the command line |
| `serve.py` | Optional local server for testing on your Mac and iPhone |

## Running it locally (optional)

```bash
python3 serve.py
```

This prints two addresses, for example `http://192.168.1.195:8000` and
`http://Your-Mac.local:8000`. Open either on the Mac, or on an iPhone on the same Wi-Fi.

iPhone Safari only allows offline mode and keeping the screen on over HTTPS (or
`localhost`). Over plain `http://192.168.x.x` the app works while the Mac is reachable, but
it won't open offline and the screen may sleep. Use the live HTTPS address for the
installed app.

For local HTTPS, use mkcert (`brew install mkcert`):

```bash
mkcert -install && mkcert -cert-file cert.pem -key-file key.pem 192.168.1.195 Your-Mac.local localhost && python3 serve.py --https
```

Then trust the certificate on the iPhone:
1. Run `mkcert -CAROOT` and AirDrop `rootCA.pem` from that folder to the phone.
2. Install it (Settings → Profile Downloaded).
3. Enable it under Settings → General → About → Certificate Trust Settings.

Then open `https://192.168.1.195:8443`. `*.pem` files are git-ignored, so keys are never
published.
