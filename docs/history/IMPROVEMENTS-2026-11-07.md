# 20 ways to improve or simplify the codebase

Written 2026-11-07, from what went wrong or felt clumsy while building notification attachments and the light theme.
This is a list of ideas, not an audit: check each one against the code before starting it. Nothing here has been
started.

Effort: **S** is a few hours, **M** is a day or two, **L** is several days.

## Stop doing the same work twice

| # | Change | Why | Effort |
|---|---|---|---|
| 1 | Share the mobile code between the starter kit and `expo-boilerplate`, or add a check that flags differences | Every UI change is copied by hand, and a port once skipped the boilerplate's notifications on a wrong assumption | L |
| 2 | Keep demo notifications in one place | They are spread across `demo-notifications.ts`, `scripts/lib/notifications-demo.ts`, the seed and the boilerplate's `sample-notifications.ts` | S |
| 3 | Share attachment logic between web and mobile | Each has its own attachment UI and labels; rules like "is this a photo?" should live in one place | S |
| 4 | Define a notification type in one place | Adding `notifications.showcase` meant editing several separate files | M |
| 5 | Generate the colour table in ADR 079 from `mobile-theme.ts` | The hex values are hand-copied and were rewritten after each colour change | S |

## Make tooling safer

| # | Change | Why | Effort |
|---|---|---|---|
| 6 | Give each Claude session its own git worktree and ports | Two sessions share `main`, so one has to stop while the other's gate runs | M |
| 7 | Add a lock so only one gate or capture runs at a time | Parallel runs signed the phone out | S |
| 8 | Add a proper `pnpm demo:stack` command with its own database, Redis and cleanup | Throwaway scripts had bugs and left `starter_attachments_demo` behind | M |
| 9 | Build one screenshot command that signs in once and runs apps one at a time | Parallel captures caused 1,262 blocked requests and a login lockout of about 50 minutes | M |
| 10 | Reject screenshots that show an error, skeleton or empty page | Bad shots were only caught by eye, including a skeleton and "could not be loaded" | S |
| 11 | Make the phone capture restore its settings afterwards | It changes the theme and drawer style, which then have to be checked by hand | S |
| 12 | Use test IDs in Maestro flows | Steps rely on visible text such as `coffee-refill-01.webp` and a loading label, so they break when the text changes | S |
| 13 | Add a command that updates `migrations-baseline.json` | It is a manual step after every reset, and this was the twentieth | S |
| 14 | Add a fast `pnpm check:changed` command | The full gate is slow, so scoped checks are put together by hand | M |

## Finish and tighten notifications

| # | Change | Why | Effort |
|---|---|---|---|
| 15 | Build the iOS Notification Service Extension | The last gap: the API already sends the image, but iOS cannot show it yet | M |
| 16 | Stop giving SMS an `attachments: []` field | SMS cannot carry attachments, so each channel should have its own message type | S |
| 17 | Download each email attachment once per send | Sending to many people may fetch the same file repeatedly; measure this first | S |
| 18 | Allow only the API's address in the development CSP | The fix allows all `http:` images in development, which is wider than needed | S |

## Simplify the UI system

| # | Change | Why | Effort |
|---|---|---|---|
| 19 | Move `light:` overrides out of components and into tokens | Classes like `bg-muted light:bg-primary` put theme decisions in component code | S |
| 20 | Cut the theme and drawer combinations | Six themes and five drawer looks make 30 combinations to test and screenshot. **The owner's call** | S |

## Where to start

| Order | Items | Why |
|---|---|---|
| 1 | 6 and 7 | They stop sessions colliding, which cost the most time |
| 2 | 9 and 10 | They make screenshots reliable |
| 3 | 1 | The biggest job, but it removes the most repeated work over time |

## Quick fix found along the way

`docs/adr/079-mobile-visual-system.md` has two item 6s in its Decision list; the second comes after item 8.
