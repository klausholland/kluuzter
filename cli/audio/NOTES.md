# librespot / WSL2 audio spike — notes

**STATUS: PENDING human verification — the audio spike (Task 1 Step 6) has NOT yet been run.**

This file is a scaffold written by an automated agent that implemented Steps 1–5 and 7
of Task 1 (the `getDevices()` helper and `cli/audio/spike.ts`). The agent has no
speakers, no librespot installation, and no real Spotify access token, so it could
**not** perform Step 6 (the actual audio spike). Nothing below should be read as a
confirmed result — it is a checklist and set of proposed defaults for the human running
the spike to fill in.

## Why this matters

Per the CLI design spec (§8), this is the highest-risk rim of the whole project. If
audio cannot be produced from WSL2 via librespot, the CLI's core premise (playing
Spotify audio without a GUI) is broken and needs to be re-evaluated before any further
CLI work (Tasks 2+) is built on top of it. Task 9's `librespot.ts` wrapper will depend
directly on the flags confirmed here — do not skip this.

## Manual steps to perform (Task 1, Step 6)

1. **Install librespot.** Document the exact method used. Candidates:
   - `cargo install librespot --features pulseaudio-backend` (build from source via
     Rust toolchain; requires `libpulse-dev` / `pkg-config` on the WSL2 Debian/Ubuntu
     image).
   - A prebuilt binary release from the librespot GitHub releases page, if one matching
     the WSL2 distro/arch (likely `x86_64-unknown-linux-gnu`) is available.
   - Distro package (e.g. `apt install librespot`) if present and recent enough.

   After installing, run `librespot --help` and **confirm the actual flags** — do not
   trust the proposed flags below until verified against the installed version's
   `--help` output.

2. **Verify WSL2 audio output works at all (make-or-break check).**
   - Run `pactl info` — it should report a PulseAudio server (WSLg bridges this
     automatically on recent Windows 11 / WSL2 builds). If it fails, audio needs to be
     enabled first (WSLg update, or a manual PulseAudio bridge such as PulseAudio for
     Windows) before librespot is even worth installing.
   - Play any test sound (e.g. `paplay /usr/share/sounds/alsa/Front_Center.wav` or
     similar) and confirm you can actually **hear** it through the host machine's
     speakers/headphones.
   - If there is no audio server reachable from WSL2, STOP here and record the blocker
     below — this is the condition under which Step 6 says to halt and re-evaluate the
     audio rim before continuing to later tasks.

3. **Obtain a temporary access token.**
   - Run the existing webapp: `npm run dev`.
   - Log in with Spotify.
   - Copy a token from the `/api/spotify/token` route (or generate one via the Spotify
     developer console) that has streaming scope.
   - `export KLUUZTER_SPIKE_TOKEN=...`

4. **Run the spike.**
   - Install `tsx` if not already present: `npm i -D tsx` (this is formally Task 2's
     job, but is needed here to execute the spike script).
   - `source ~/.nvm/nvm.sh && nvm use 22 && npx tsx cli/audio/spike.ts`
   - Confirm you **hear the track** ("Never Gonna Give You Up" by default, or override
     with `KLUUZTER_SPIKE_URI`).

5. **Fill in this file** with the install command actually used, the confirmed
   librespot flags, the WSL2 audio setup steps that worked, and any gotchas
   encountered — then update the status line at the top of this file.

## Proposed librespot flags (from `spike.ts`) — to be confirmed against `librespot --help`

`spike.ts` currently spawns:

```
librespot --name Kluuzter --access-token <token> --bitrate 320
```

Unconfirmed assumptions baked into this command, to verify against the real
`--help` output of the installed version:

- `--access-token <token>` is assumed to be the flag for logging in with a bearer
  token obtained via the Web API / OAuth (as opposed to `--username`/`--password`,
  a `--cache`-based stored credential, or an interactive OAuth prompt). Some
  librespot versions/builds may not support `--access-token` at all, or may name it
  differently (e.g. `--token`).
- No explicit `--backend` flag is passed; librespot may default to ALSA rather than
  PulseAudio, which could be silent under WSL2. If audio doesn't come through, try
  adding `--backend pulseaudio` (requires the binary to have been built with PulseAudio
  support).
- `--bitrate 320` is assumed valid without a Spotify Premium check failure; confirm.
- `--name Kluuzter` is assumed to control the device name shown via
  `getDevices()`/Spotify Connect; `spike.ts` polls for a device named exactly
  `"Kluuzter"`.

## CONFIRMED FLAGS (fill in after running)

> Fill in this section once Step 6 has actually been performed by a human with
> working WSL2 audio and a real librespot binary. Task 9's `librespot.ts` wrapper
> depends on these being accurate.

- Install method used:
- librespot version (`librespot --version`):
- Confirmed token-login flag:
- Confirmed audio backend flag (if any):
- Other required/recommended flags:
- WSL2 / PulseAudio setup steps that worked (`pactl info` output, any bridge needed):
- Gotchas / surprises:
- Did audio play and was it audible? (yes/no — be honest):

## Blocker log (fill in only if Step 6 cannot be completed)

If WSL2 audio output cannot be made to work at all, record the blocker here and
escalate before proceeding to later CLI tasks, per Step 6 of the Task 1 brief.

- (none recorded yet — pending human run)
