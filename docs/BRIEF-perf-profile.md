# Brief — profile page experience pass (follows the performance pass; owner: "optimise the profile page experience too")
Working directory D:/Projects/Web/andptri-site. Final report in Vietnamese. Commit locally; do NOT push (the orchestrator verifies and pushes).

## Hard rules
- The profile's design, wording, content, layout and look at default settings stay EXACTLY as they are (owner approved it). This is about how it FEELS and performs, not how it looks. Prove no visual change with before/after screenshots at 1440x900 and 390x844 (diff must be noise only).
- Same cold-load rule as docs/BRIEF-perf.md: no service worker or custom caching; measure with the cache disabled and with throttling (4x CPU slowdown, Fast/Slow 4G).

## Look at, measure, and improve (only what the numbers/real tests show)
1. Interaction latency (INP): typing in the prompt, running each command (help, projects, open N, contact, clear, mute, logout, sudo/hack/thepeak easter eggs, unknown command), `--all` toggle, hover scramble on project rows, chip buttons. Measure with the Event Timing API / long tasks; keep every interaction under ~100 ms on 4x CPU slowdown.
2. Scrolling and rendering cost: the full-screen fixed overlays (scanlines, grain, CRT vignette — body:before/body:after with repeating gradients and large inset box-shadow) and any continuous animation or interval (glitch tear every ~23 s, HUD clock/uptime, cursor blink). Promote to their own compositor layers or cheapen them (e.g. pre-rendered tile, will-change/contain, pause when off-screen or tab hidden), without changing how they look. Idle CPU after the opening should be near zero.
3. Mobile 390 wide: tap targets >= 44 px, the on-screen keyboard must not hide the prompt (visualViewport / scroll-into-view), no horizontal scroll, no zoom-on-focus (input font-size >= 16px if that does not change the look noticeably at default, otherwise use the viewport approach), 100dvh handling, tap feedback.
4. Keyboard and accessibility: tab order and visible focus, Enter/Escape behaviour, aria-live for command output, skip link, reduced-motion path, colour contrast (do not change colours; report only), screen-reader names for the prompt and chips.
5. Perceived responsiveness: the profile must be fully ready instantly when the tear ends (no layout shift, no re-render, fonts already loaded — check CLS = 0 and that nothing re-flows at hand-over), correct scroll position and focus after hand-over (focus should land sensibly, e.g. the prompt, without scrolling the page).
6. Low-power fallback: on devices with `navigator.hardwareConcurrency <= 4` or `deviceMemory <= 4` or `prefers-reduced-motion`, lighten ambient effects only (never content) and say what changed.
7. Robustness: window resize / orientation change during and after the opening, tab switch, back/forward cache, replay via `logout` repeated 5 times (no leaks: heap and DOM node counts stable, listeners not accumulating, AudioContext not duplicated).

## Deliver
docs/PERF-PROFILE.md with a before/after table (INP-like timings, long tasks, idle CPU, heap after 5 replays, CLS) and a list of changes and of things deliberately left alone; real-browser verification (Playwright, node C:/Users/andan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe, playwright at ../node_modules/playwright, chromium channel 'chrome'); serve with C:/Users/andan/.local/share/serve-portfolio.py <port> D:/Projects/Web/andptri-site. No console errors. Self-review loop: look at screenshots, fix, repeat.
