# Brief — return visits auto-skip on click, plus a small replay button (owner's words, literal)
Working directory D:/Projects/Web/andptri-site. Final report in Vietnamese. Commit locally; do NOT push (the orchestrator verifies and pushes).

Owner: "From the second visit on, when entering the site it automatically skips (i.e. no more of that sequence — it is as if the user pressed skip straight away), BUT it must NOT jump into the profile immediately: the very first page is still shown, and when the user clicks it, that is equivalent to pressing skip. And add a small replay button somewhere in the profile page."

## Behaviour
1. First visit (nothing stored): exactly as now — the full opening (boot → panic → NO SIGNAL bounce → tear → profile).
2. Return visits: the page still shows the opening's FIRST screen (the "Link established." screen with the "Connect with sound" prompt, skip and SND controls). The timed sequence does NOT start and nothing auto-advances; the screen waits. Any click/tap on it, or Enter/Space/Esc, behaves exactly like pressing the skip button today (same direct tear from the current screen into the ready profile, same sound unlock, same hide-controls-in-the-tear behaviour). Do not auto-jump into the profile on load.
3. Remember a visit only after the opening has been completed or skipped once (localStorage key, wrapped in try/catch; if storage is unavailable/private mode, behave as first visit every time). This is user state, not asset caching — do not add any service worker or asset caching.
4. Replay: add a small, quiet button in the profile page (monospace, same visual language, e.g. `[ replay intro ]` or `↻ replay`) placed unobtrusively (e.g. beside the existing quick-command chips row, in the window title bar, or in the footer line — choose the least intrusive; it must not change the profile's layout/look otherwise). Clicking it plays the FULL opening again (like the existing `logout` command), even on return visits (do not auto-skip when replaying). The `logout` and `intro` commands keep working and also play the full opening. Keyboard accessible, proper aria-label, tap target >= 44px on mobile while visually small (padding/hit area).
5. Do not change anything else (profile content/design, sound design, tear visuals, timings of the first-visit sequence).

## Verify (real browser, Playwright; node C:/Users/andan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe, playwright at ../node_modules/playwright, chromium channel 'chrome'; serve with C:/Users/andan/.local/share/serve-portfolio.py <port> D:/Projects/Web/andptri-site)
- Fresh context: full opening runs; after finishing the flag is stored.
- Second load in the same context: first screen shown, no timed progression (check that after 5 s the screen is still the first screen), click → direct tear into profile; Enter/Space/Esc also work.
- Replay button visible in the profile at 1440 and 390 without layout changes elsewhere (before/after pixel comparison of the profile with the button hidden vs the old build must differ only at the button), click → full opening plays from the start, even on a return visit; then profile again.
- `logout` still replays; storage disabled (e.g. localStorage throwing) → no errors, behaves as first visit.
- No console errors; docs/RETURN-VISIT.md with results.
