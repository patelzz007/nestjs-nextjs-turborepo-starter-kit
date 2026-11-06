# Pending: blue and white light theme

Status: **paused by the owner on 2026-11-06, to come back to later.** Nothing here is in the code. Every colour below was only tried in the browser.

Previews: [Blue and white in the content](https://claude.ai/artifact/YMF39gvZDjk4bGiPs6X3EX) (private to the owner). It holds the latest 5 options for web, merchant and admin. Earlier rounds are in its version history.

## What the owner wants

| Want | Detail |
| --- | --- |
| Overall look | White with a touch of blue. The faintest blue was liked |
| Content | Blue and white together: faint blue page, white cards. Not white alone |
| Sidebar | Blue, with an obvious separation from the content |
| Grey | No grey element anywhere in the blue |
| Brand colours | Web stays blue, merchant green, admin slate |
| Mobile | Change the background to the faintest blue and keep the rest as it is |
| Afterwards | Take new screenshots, update them in `README.md`, then run everything still unverified |

## Rejected so far

| Round | Colours | Owner's answer |
| --- | --- | --- |
| Mobile's blue, 5 options | Page `#e7f3fb`, cards `#f2f9fd` | Liked option 2 (sidebar `#f2f9fd`), asked for less blue |
| Option 2 with less colour | Page `#e9f2f8` to `#ecf2f5` | Neither: sidebar must be blue, split must be obvious, no grey |
| Deeper sidebars | Sidebar `#d6e8f6` to `#bcd7ed` | Far too dark |
| Near-white | Page `#fafdff`, cards `#fdfeff` | Faintest was liked, but the content lost its blue |

## Current options

Cards are `#ffffff` in all five. This replaces the old "no pure white" rule, because the owner asked for white.

| Option | Page | Sidebar | Soft fills | Sidebar hover |
| --- | --- | --- | --- | --- |
| 1. Faintest page | `#f7fbfe` | `#f3f9fe` | `#f3f9fe` | `#e7f2fb` |
| 2. Faint page and sidebar | `#f3f9fe` | `#f3f9fe` | `#f3f9fe` | `#e7f2fb` |
| 3. Faint page, bluer sidebar (recommended) | `#f3f9fe` | `#ecf5fc` | `#f3f9fe` | `#e0eefa` |
| 4. Light blue page and sidebar | `#f0f7fd` | `#f0f7fd` | `#f0f7fd` | `#e3f0fa` |
| 5. Light blue page, bluer sidebar | `#f0f7fd` | `#e8f3fb` | `#f0f7fd` | `#dcecf8` |

## Decisions still needed

| # | Question | Recommendation |
| --- | --- | --- |
| 1 | Which option for web, merchant and admin? | Option 3 |
| 2 | Mobile: background only, or background and cards? | Both. Mobile cards are `#f2f9fd`, so on these pages they look sunken (`#f7fbfe`), almost vanish (`#f3f9fe`) or barely lift (`#f0f7fd`) |
| 3 | Does the docs site change too? | Yes. It shares today's background, so it would stay on the old colour |
| 4 | Do mobile's outlines turn blue? | Owner's call. The phone's rule since 2026-11-06 is neutral grey outlines, while web would have blue ones. "Keep the others as it is" suggests no |

Mobile changes go to expo-boilerplate too, identically.

## How to build it

Change only the light theme, in the token source (`packages/tokens/src`), then run `pnpm tools tokens:generate`. Dark and Nord stay as they are.

| Variable | Value |
| --- | --- |
| `--background`, `--topbar`, `--shell-panel` | Page |
| `--card`, `--sheet`, `--popover` | Cards |
| `--secondary`, `--muted`, `--accent` | Soft fills |
| `--sidebar`, `--shell-frame` | Sidebar |
| `--sidebar-accent` | Sidebar hover |
| `--border` | `#d6e6f3` |
| `--sidebar-border` | `#cfe2f2` |
| `--input` | `#c6dbec` |
| `--muted-foreground` | `#3f6285` |
| `--sidebar-foreground` | `#1f3a56` |

The grey comes from the neutral scale itself. Its colours are only faintly tinted, so re-tint the whole scale at hue 240 instead of patching elements:

| Step | Lightness | Chroma |
| --- | --- | --- |
| 25 | 0.992 | 0.004 |
| 40 | 0.986 | 0.006 |
| 50 | 0.976 | 0.010 |
| 100 | 0.955 | 0.016 |
| 200 | 0.925 | 0.024 |
| 300 | 0.87 | 0.035 |
| 400 | 0.72 | 0.05 |
| 500 | 0.58 | 0.06 |
| 600 | 0.5 | 0.06 |
| 700 | 0.41 | 0.06 |
| 800 | 0.33 | 0.055 |
| 900 | 0.26 | 0.045 |

The previews also mapped `--palette-gray-*` to this ramp. Check first who reads that scale, because the web apps' dark theme is meant to stay pure grey.

## Known problems to fix

| Problem | Where |
| --- | --- |
| Chart axis labels are grey `#666`, the chart library's default. The previews recoloured them in the browser only; the real fix is to pass a tick colour | Admin charts |
| The top "Brew & Bean KL" card keeps a darker outline that doesn't follow the variables | Merchant dashboard |
| Locked menu items are dimmed on purpose and look faint, so check they stay readable | Web and merchant sidebars |

## Steps when we come back

1. Get the answers to the four decisions.
2. Build it in the token source, and in the mobile theme of both repos.
3. Check the pages the previews didn't cover: login pages, tables, forms and dialogs.
4. Update the contrast and token tests, then the visual snapshots. Admin has 211 visual tests, so expect many to change.
5. Take new screenshots and update them in `README.md`.
6. Run the whole gate, and clear the list below.

## Still not verified

Updated after the follow-up checks on 2026-11-06. Everything else from the earlier list passed; see the progress log.

| Item | Why it's open |
| --- | --- |
| Firebase, AWS and other key steps in the README | No real keys were created |
| Phone in Expo Go, Linux, Windows | Need a real device or those systems |
| The analytics consumer running | Its login and setup passed, but running it would move the consumer's position on the shared local Kafka |
| GitHub Build fix | Needs a push; why the runner died is unproven |
| Mobile nightly | The fix is in the working tree and needs a push to prove |
| `sidebar (dark)` snapshot | Replaced, with the cause of the 53-pixel difference unproven |
| Fresh clone of the commit | Needs a commit |
| expo-boilerplate's Maestro flows | Its `signed-in.yaml` doesn't skip onboarding, so a fresh install would stop there. No CI job runs it |

## How the previews were made

| Topic | Note |
| --- | --- |
| Method | Playwright signs in, sets the variables on `html` and `body`, then takes a 1440×900 screenshot |
| Sign-ins | Save the session once and reuse it. The login limit is per IP and escalates: repeated runs on 2026-11-06 blocked every password sign-in on this machine for about an hour |
| Isolation | Use a clean copy with its own database and spare ports, so the dev stack stays untouched. `LOGIN_VERIFICATION_MODE=disabled` skips the emailed code there |
| Grey scan | Walk every visible element and flag colours with OKLCH chroma under 0.015; a near-white only has to lean blue. Run it on today's colours first to prove it fires |
| Monitors | Judge web colours on a monitor, and mobile colours on the owner's phone |
