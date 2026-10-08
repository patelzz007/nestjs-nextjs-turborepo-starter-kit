# 27 — Array index readability

## Purpose

Numeric literals in bracket access (`items[0]`, `match[1]`, `pair[1]`) hide meaning. Readers must guess what "0" and "1" represent in **that** list. Name the position instead.

## Rule

Never read or write a list position with a numeric literal in brackets: `[0]`, `[1]`, `?.[2]`, `row[0] = …`. ESLint enforces this in every TypeScript file (`no-restricted-syntax`, `packages/eslint-config/restricted-syntax-rules.js`).

Pick the replacement that names the position best, in this order:

| Situation | Use | Example |
|---|---|---|
| A tuple or a fixed-shape list you read once | **Destructuring** | `const [year, month, day] = segments;` · `.sort(([left], [right]) => left - right)` · `const [, payload] = token.split(".")` |
| A RegExp match | **Named capture groups** | `/(?<value>\d+)(?<unit>[smhd])/` → `match.groups?.value` |
| A position with domain meaning, read in several places | **A domain index map** | `const ARGV_INDEX: { readonly script: 1 } = { script: 1 }` → `process.argv[ARGV_INDEX.script]` |
| A generic "first / second item" (tests, `getAll…` results, `mock.calls`) | **`LIST_SLOT_INDEX`** from `@workspace/shared` | `rows[LIST_SLOT_INDEX.first]` · `mock.calls[LIST_SLOT_INDEX.first]?.[LIST_SLOT_INDEX.second]` |

### `LIST_SLOT_INDEX` keeps tuple types

`LIST_SLOT_INDEX` is typed with **literal** indices (`first: 0`, `second: 1`, …), so indexing a tuple keeps the exact element type of that position:

```ts
import { LIST_SLOT_INDEX } from "@workspace/shared";

const entry: [number, Buffer] = [1, key];
const version: number = entry[LIST_SLOT_INDEX.first]; // number, not number | Buffer
const secret: Buffer = entry[LIST_SLOT_INDEX.second];
```

A domain index map must be typed the same way (literal values in an explicit interface), or tuple reads widen to the union of every element. `Record<"publish", number>` is **not** enough:

```ts
// ✅ Literal-typed — DEPLOY_STEP_INDEX.publish has type 1
interface DeployStepIndex {
	readonly validate: 0;
	readonly publish: 1;
}
const DEPLOY_STEP_INDEX: DeployStepIndex = { validate: 0, publish: 1 };

// ❌ number-typed — reads from a tuple lose their position type
const DEPLOY_STEP_INDEX: Record<"validate" | "publish", number> = { validate: 0, publish: 1 };
```

### RegExp: name the groups, not the indices

```ts
// ❌ Which group is "1"? And "second" for group 1 is actively misleading.
const unit = match[2];
const unit = match[LIST_SLOT_INDEX.third];

// ✅ The pattern documents itself
const EXPIRY_PATTERN = /^(?<value>\d+)(?<unit>[smhd])$/;
const unit = EXPIRY_PATTERN.exec(expiry)?.groups?.unit;
```

## What stays allowed

| Pattern | Why |
|--------|-----|
| `for (const x of items)` / `.map` / `.find` / `.at(i)` | No magic literal |
| `const [head, ...rest] = items` | Names carry meaning |
| `items[i]` when `i` is a variable | Not a fixed literal |
| `record["0"]` (a string key) | Not a list position |

## Related

- `00-non-negotiables.md` — no magic numbers without named constants
- `11-testing-vitest.md` — the same bar applies in tests
- `28-runtime-validation.md` — the same "no hand-rolled shortcut" spirit for runtime type checks
