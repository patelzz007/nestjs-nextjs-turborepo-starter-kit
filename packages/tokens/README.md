# @workspace/tokens

The one source of the design tokens for every platform ([ADR 030](../../docs/adr/030-shared-design-token-source.md)):
colours (palette primitives and semantic roles per theme), radii, type sizes, z-index layers,
easing curves and the Tailwind `@theme` mapping, written as typed TypeScript data and validated by
zod. A generator turns them into committed CSS: `web.css` for the Next.js apps (through
`packages/ui`), `palette.css` for the docs site and `mobile.css` for the Expo app (Uniwind,
[ADR 032](../../docs/adr/032-uniwind-for-mobile-styling.md)). The package has no runtime
dependencies and imports no other workspace.

## Structure

```
src/
  schema.ts           zod schemas for every token type; all types are inferred from them
  value.ts            typed constructors used by the data files (oklch(), paletteColor(), rem(), …)
  palette.ts          primitive scales → --palette-<scale>-<step>
  semantic.ts         LIGHT_THEME / DARK_THEME (one role list, exhaustive) + SHARED_COLORS
  radius.ts           --radius and the rounded-* scale factors
  typography.ts       font roles and app-shell type sizes
  layout.ts           z-index layers and web-chrome sizes
  motion.ts           easing curves
  tailwind-theme.ts   the @theme inline mapping (colour utilities, shadows, radius scale, …)
  source.ts           TOKEN_SOURCE — everything above, as the generator reads it
  resolve.ts          follow references to a theme's literal colour (mobile output, JS consumers)
  index.ts            public entry: token data, types, resolveColorToken (no zod at runtime)
  generator/          pure renderers (web, palette, mobile), parity and staleness checks
scripts/generate.ts   writes generated/*.css
generated/            COMMITTED output — never edit by hand
```

## Getting started

| Task | Command |
|---|---|
| Change a token | Edit the TypeScript in `src/`, then run `pnpm tokens:generate` from the repo root and commit `generated/` |
| Regenerate only | `pnpm tokens:generate` (or `pnpm --filter @workspace/tokens generate`) |
| Test | `pnpm --filter @workspace/tokens test` |

Consumers import the generated CSS:

```css
@import "@workspace/tokens/web.css"; /* packages/ui globals.css */
@import "@workspace/tokens/palette.css"; /* apps/docs: primitives only */
@import "@workspace/tokens/mobile.css"; /* apps/mobile global.css */
```

Code that needs a value in JavaScript uses the TypeScript entry:

```ts
import { resolveColorToken, TOKEN_SOURCE } from "@workspace/tokens";

const statusBar = resolveColorToken(TOKEN_SOURCE, "dark", "background"); // "oklch(0.225 0.015 258)"
```

## What the generator guarantees

- **Every theme defines every role.** Themes are typed from one role list (`ThemeRoleSchema`), so a
  missing role is a compile error; the generator also parses the source with zod and checks that
  every theme / Uniwind variant declares the same variables, and exits non-zero otherwise.
- **Every value is supported** (zod): oklch / six-digit hex / `transparent` colours, rem / px lengths,
  integer z-index layers, cubic-bezier curves, references to existing palette steps and tokens.
- **Deterministic output**: the order comes from the schema enums, numbers have one canonical
  spelling, so regenerating never produces a diff by itself.
- **Staleness check**: `src/generator/staleness.test.ts` regenerates in memory and fails
  `pnpm run test` (and CI) when a committed file is stale, hand-edited, missing, or a leftover.

## Key conventions

- Token ownership, the palette / semantic layering and app themes: [`rules/07-ui-system.md`](../../rules/07-ui-system.md)
  ("Palette — primitives, semantic tokens, one accent").
- Where the package sits in the dependency graph: [`rules/01-repository-architecture.md`](../../rules/01-repository-architecture.md).
- No `as const`, casts, runtime `typeof` or numeric indices: [`rules/00-non-negotiables.md`](../../rules/00-non-negotiables.md),
  [`rules/27`](../../rules/27-array-index-readability.md), [`rules/28`](../../rules/28-runtime-validation.md).
- The full design: [`docs/technical/mobile/mobile-app.md`, section 5](../../docs/technical/mobile/mobile-app.md#5-piece-1-packagestokens).

## Environment variables

None.
