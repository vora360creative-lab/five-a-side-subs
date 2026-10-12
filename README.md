# FC Deadline Day

Substitution manager and match timer for five-a-side (38:00 matches, fixed keeper,
6–8 players). Plain HTML/CSS/JS, no build step, no backend, works offline.

## Files

| File | What it is |
| --- | --- |
| `index.html`, `styles.css`, `app.js` | The app (screens, storage, live match, wake lock, sound) |
| `logic.js` | Pure rules: stoppages, stints, match clock, template validation |
| `templates.js` | **Rotation templates as plain data. Edit these.** |
| `sounds.js` | Plays the sounds (Web Audio): synthesised warning beeps, recorded whistle |
| `sounds/whistle.mp3` | Referee whistle recording (trimmed, cached for offline use) |
| `squad.js` | **Default squad (one name per line). Edit this.** |
| `sw.js`, `manifest.json`, `icons/` | Offline support and Home Screen install |
| `serve.py` | Optional local server that prints the address to open on your iPhone |
| `validate.js` | Checks the templates from the command line |

## Run it on your Mac

```bash
python3 serve.py
```

It prints two addresses, for example `http://192.168.1.195:8000` and
`http://Your-Mac.local:8000`. Open either on your Mac, or on your iPhone on the same Wi-Fi.

Test mode: tap **Test run (x20)** under START MATCH on the rotation screen to run the
same match 20× faster (a full match in under 2 minutes). A red `TEST x20` label shows
on the live screen, and ending or finishing a test run takes you back to the same
rotation so you can START MATCH for real. Adding `?speed=N` to the address still works
too: START MATCH then runs N× faster.

## Check the templates

```bash
node validate.js
```

The same check runs automatically when the app opens on a development address
(localhost, a `192.168.x.x` / `10.x.x.x` address, or `*.local`). Failures are logged to the
browser console and also shown as a red banner in the app. A broken template is
blocked: "Generate rotation" won't run for that player count.

## Offline and keeping the screen on need HTTPS

iPhone Safari only enables the service worker (offline) and Screen Wake Lock on
HTTPS (or `localhost`). Over plain `http://192.168.x.x` the app works fully while
the Mac is reachable, but:

- it will **not** open with no connection, and
- the screen may sleep. The live screen will say *Set Auto-Lock to Never during the match*.

To get the full offline app on your phone, use one of these:

1. **Free static hosting (simplest, permanent).** Upload this folder to GitHub Pages,
   Netlify Drop (drag the folder onto app.netlify.com/drop) or Cloudflare Pages. Open the
   https address on your iPhone in Safari, then Share → **Add to Home Screen**. You can add
   `?dev` to the address to run the template check there too.
2. **Local HTTPS with mkcert.** Install mkcert (`brew install mkcert`), then:
   ```bash
   mkcert -install
   mkcert -cert-file cert.pem -key-file key.pem 192.168.1.195 Your-Mac.local localhost
   python3 serve.py --https
   ```
   Then trust the certificate on the iPhone. Run `mkcert -CAROOT`, AirDrop `rootCA.pem` from
   that folder to the phone, install it (Settings → Profile Downloaded), and enable it under
   Settings → General → About → Certificate Trust Settings. Then open
   `https://192.168.1.195:8443` and Add to Home Screen.

Data (squad, settings, a match in progress) is stored per address, so pick one address
and stick to it.

## Updating

After you edit any file, open the installed app once while the server is reachable,
then close it and open it again. The service worker downloads every file in the
background and swaps them in together on the next launch. If you add a new file,
add it to `ASSETS` in `sw.js`.

## Sound

Sound is **always off** when the app opens, after a reload, and at the start of every
match. Tap the speaker on the live screen to turn it on for that match (it shows as a
solid button while on). Sounds: two soft beeps at the 30-second warning, the recorded
referee whistle once when a sub is due, and at full time two short whistles then the
full one. Where Safari supports it, sounds play even when the iPhone is on silent.

The whistle is normalised automatically when the app loads it: its peak is set to the
warning beep's level (`WARNING_LEVEL` in `sounds.js`) and it is never louder on
average than the beep. To use a different recording, replace `sounds/whistle.mp3`
(keep the name); leading silence is skipped automatically.

## Default squad

`squad.js` holds the default squad. A device with no saved squad loads it automatically on
first open; a device that already has its own squad keeps it. To pick up edits to
`squad.js` on a device, tap **Reset to default squad** at the bottom of the Squad screen
(it asks first). Players who are in both lists keep their match-setup selections.

## Editing rotations

Each template in `templates.js` lists periods of four outfield roles. A–D are the
starting four in tap order; E, F, G are the bench in order. Stoppage OFF/ON lists are
worked out automatically from the change between periods. Keep `expected` in sync
with the minutes, then run `node validate.js`.
