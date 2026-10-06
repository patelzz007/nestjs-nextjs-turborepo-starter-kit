# 07 — UI System Standards

## Component philosophy

Reusable UI primitives must be: stateless, accessible, composable, themeable, controlled, ref-forwarding where applicable, data-agnostic, responsive, and generic enough to handle use cases you haven't seen yet without needing to be modified.

## Ref forwarding

```tsx
// ❌ DON'T — no ref forwarding means this component can never be focused
// programmatically, can't participate in form libraries that need a ref
// to the underlying input, and can't be the target of a "scroll to first
// error" behavior on a failed form submit
export function Input(props: InputProps) {
  return <input {...props} />;
}

// ✅ DO
export const Input = forwardRef<HTMLInputElement, InputProps>(
  function Input(props: InputProps, ref: ForwardedRef<HTMLInputElement>): ReactElement {
    return <input ref={ref} {...props} />;
  },
);
```

Mandatory for any component wrapping a focusable DOM primitive.

## Event contracts

```tsx
// ❌ DON'T — invented, non-standard event names that every consumer has
// to look up individually instead of already knowing from every other
// input-like component in the codebase
<CustomInput onValueSet={(v) => ...} onFieldTouch={() => ...} />

// ✅ DO — the standard contract every developer already expects
<CustomInput onChange={(e) => ...} onBlur={() => ...} onFocus={() => ...} />
```

Expose standard events where applicable: `onChange`, `onBlur`, `onFocus`, `onKeyDown`. Don't invent custom names unless the interaction genuinely needs a different semantic event that the standard ones can't express.

## Variants

Use CVA (or the repo-approved equivalent). Standard variant axes: `variant`, `size`. Standard state axis covers: `disabled`, `loading`, `error`, `selected`, `invalid`.

```ts
// ❌ DON'T — a boolean prop for every possible visual permutation, which
// doesn't scale and allows nonsensical combinations (isLoading AND isError
// both true at once, with no defined visual precedence)
interface ButtonProps {
  isPrimary?: boolean;
  isSecondary?: boolean;
  isSmall?: boolean;
  isLarge?: boolean;
  isLoading?: boolean;
  isDisabled?: boolean;
  isError?: boolean;
}

// ✅ DO — a small, closed set of variant axes, each with a defined set of values
const buttonVariants = cva('inline-flex items-center justify-center rounded-md font-medium', {
  variants: {
    variant: { primary: 'bg-primary text-primary-foreground', secondary: 'bg-secondary text-secondary-foreground' },
    size: { sm: 'h-8 px-3 text-sm', md: 'h-10 px-4', lg: 'h-12 px-6 text-lg' },
    state: { default: '', loading: 'opacity-70 cursor-wait', disabled: 'opacity-50 cursor-not-allowed', error: 'ring-2 ring-destructive' },
  },
  defaultVariants: { variant: 'primary', size: 'md', state: 'default' },
});
```

Don't create a distinct variant prop for every possible CSS property — that's not what the variant system is for; it's for a curated, intentional set of looks, not arbitrary styling escape hatches.

## Design tokens

```css
/* ✅ DO — semantic tokens, mapped through the theme, consumed via Tailwind utilities */
:root { --background: 0 0% 100%; --primary: 240 5.9% 10%; --destructive: 0 84.2% 60.2%; }
.dark { --background: 240 10% 3.9%; --primary: 0 0% 98%; }
```

```tsx
// ❌ DON'T — hardcoded values scattered across components; a rebrand or
// theme tweak means grep-and-replace across the entire codebase, and it's
// easy to miss one, leaving an inconsistent UI
<div className="bg-[#1a1a1a] text-[14px] border-[#333]">

// ✅ DO — everything routes through tokens; changing the token changes
// every consumer at once
<div className="bg-background text-sm border-border">
```

## shadcn

shadcn components are starting points, not permission to skip architecture. Generated code gets reviewed and adapted to this doc's conventions (tokens, CVA, ref forwarding, event contract) before it's treated as done. Don't blindly regenerate a component and overwrite deliberate repository-specific changes — check git diff before running a regeneration command, or you'll silently lose fixes someone made.

## Low-level data rule

```tsx
// ❌ DON'T — "Approve Reward" baked into a generic action/table component
function GenericRowAction({ onClick }: { onClick: () => void }) {
  return <button onClick={onClick}>Approve Reward</button>; // hardcoded label, useless for anything but rewards
}

// ✅ DO — label comes from the caller; the same component works for
// "Approve Reward," "Cancel Order," "Archive Invoice," or anything else
<ActionButton label={action.label} onClick={action.onClick} />
```

Never hardcode business labels inside generic components.

## Production polish

```text
❌ DON'T ship a component that only renders correctly for the happy path
   — a table with data, on a fast connection, that never errors. That
   covers maybe 60% of what a real user will actually experience.

✅ DO ship, at minimum: a loading state (skeleton/spinner, not a blank
   screen), an empty state, an error state with retry where applicable,
   correct spacing from the token/spacing scale, and correct typography
   scale.
```

## Accessibility checklist

Semantic HTML; keyboard support; visible focus; accessible names; correct labels; ARIA only where actually necessary (don't add `role="button"` to an actual `<button>` — it already has that role); error association (`aria-describedby`); dialog focus handling/trapping; table header semantics; sufficient contrast; reduced-motion awareness.

## Responsive design

Verify every new/changed layout at mobile, tablet, desktop, and wide-desktop widths, using responsive utility classes rather than JS-based breakpoint detection (`useEffect` + `window.innerWidth` reads are slower, cause layout flicker on load, and don't work during SSR).

## Compound components and slot patterns

For a component with several related, co-dependent parts (a `Card` with a header/body/footer, a `Tabs` with a list and panels), prefer a compound-component pattern over one giant component with a dozen boolean/config props trying to control every internal section.

```tsx
// ❌ DON'T — a single component with an ever-growing prop surface trying
// to configure every possible internal section
<Card
  title="Order #123"
  showFooter
  footerText="View details"
  footerAlign="right"
  headerIcon={<TruckIcon />}
  bodyPadding="lg"
/>

// ✅ DO — composable parts, each independently simple, combined by the
// caller in whatever arrangement THEY actually need
<Card>
  <Card.Header icon={<TruckIcon />}>Order #123</Card.Header>
  <Card.Body padding="lg">{children}</Card.Body>
  <Card.Footer align="right">View details</Card.Footer>
</Card>
```

This keeps each part's props small and focused, and lets a consumer omit or reorder parts freely — something a single monolithic component with a flag for everything can never really offer.

## Portals — used deliberately, not by default

Modals, tooltips, and dropdowns commonly need to render outside their parent's DOM hierarchy (via a portal) to escape `overflow: hidden`/`z-index` stacking-context issues from an ancestor. Use a portal specifically for that reason — don't reach for one as a default for every floating element without a concrete stacking problem it's solving, since portals add real complexity around focus management and event bubbling that a normally-positioned element doesn't have.

## Animation

```tsx
// ❌ DON'T — an animation with no respect for the user's reduced-motion
// preference, which for some users isn't a mere preference but a real
// accessibility need (vestibular disorders, motion sensitivity)
<div className="animate-bounce">

// ✅ DO — respect prefers-reduced-motion, either via a Tailwind
// variant or a CSS media query, for every non-essential animation
<div className="motion-safe:animate-bounce">
```

Keep animation duration and easing driven by design tokens (`07-ui-system.md`-equivalent — token discipline applies here too), not one-off hardcoded millisecond values scattered per component.

## Loading skeletons

```tsx
// ❌ DON'T — a generic spinner for every loading state regardless of
// what's loading, which gives the user no sense of the shape of what's
// about to appear and causes a jarring layout shift once real content pops in
{isLoading ? <Spinner /> : <OrdersTable rows={data} />}

// ✅ DO — a skeleton shaped like the actual content that's coming,
// which both looks more polished and prevents layout shift
{isLoading ? <OrdersTableSkeleton rows={10} /> : <OrdersTable rows={data} />}
```

A bare spinner is acceptable for a genuinely small, unpredictably-shaped piece of UI (a button's own loading state); for a whole section/page, a skeleton matching the eventual layout is the standard.

## Toast/notification patterns

```tsx
// ❌ DON'T — trigger a toast directly from deep inside a dumb/presentational
// component, which means that component now has a side effect and an
// opinion about global UI state, breaking the smart/dumb boundary
// (05-...) just as much as fetching its own data would
function SaveButton({ onSave }: Props) {
  const handleClick = async () => {
    await onSave();
    toast.success('Saved!'); // a presentational button now owns global notification state
  };
}

// ✅ DO — the smart component (or the mutation's onSuccess callback)
// triggers the toast; the button just reports that it was clicked
function SaveButton({ onClick }: Props) {
  return <Button onClick={onClick}>Save</Button>;
}
// in the smart component:
const mutation = useMutation({ mutationFn: saveOrder, onSuccess: () => toast.success('Saved!') });
```

## Icon usage

Use one icon library consistently (as already noted) and treat icons as decorative-by-default — an icon-only interactive element (a button with just an icon, no visible text) MUST have an accessible name via `aria-label`, since a screen reader has nothing else to announce.

```tsx
// ❌ DON'T
<button onClick={onDelete}><TrashIcon /></button> // announced to a screen reader as just "button" — no indication what it does

// ✅ DO
<button onClick={onDelete} aria-label="Delete order"><TrashIcon aria-hidden="true" /></button>
```

## Palette — primitives, semantic tokens, one accent

All colour is defined ONCE in `packages/ui/src/styles/tokens.css`, in two layers:

1. **Primitives** — `--palette-neutral-0…950` (slate-cast greys, the light theme),
   `--palette-night-50…950` (pure greys, the dark theme), `--palette-brand-50…950` (slate, admin and
   docs), `--palette-blue-*` (web) and `--palette-green-*` (merchant) and `--palette-warm-*` (kopi amber, the charts' counter-colour). Raw scales only.
2. **Semantic tokens** — `--background`, `--primary`, `--border`, `--sidebar-*`, `--chart-*`, … each
   mapped onto a primitive step per theme (`:root` / `.dark`).

Components read **semantic tokens only**, never `--palette-*` — the mapping is what lets light and
dark (and a future rebrand) change in one place. App themes (`apps/*/app/*-theme.css`) may re-map
**brand tokens only** (`APP_BRAND_TOKENS` in `lib/core/color-contrast.ts`) onto their hue — web is
blue, merchant green, admin uses the shared slate — and never neutrals, surfaces or borders; each
app's theme test enforces that and proves the layered theme's contrast. The docs site (`apps/docs/src/styles/global.css`) mirrors it as hex —
change both together. Every text pair meets WCAG AA and every ring / chart series meets 3:1
(`tokens-contrast.test.ts`).

- **Brand colour is reserved for meaning** — primary actions, links, focus rings, the light-mode
  active nav pill and the lead chart series. In dark mode the active nav row is a soft neutral
  filled pill (no outline) in every app; the brand stays on buttons, focus and charts. Hover rows stay neutral. Status
  (success / warning / destructive / info) and the categorical tone palette are separate tokens —
  never use the accent to signal state.

## Shell surfaces — white in light mode, elevation in dark mode

Panel shells (admin, web, merchant):

- **Light mode** — one white surface (`neutral-0`) for the sidebar, topbar, page and cards. Structure
  comes from borders: the darker `--sidebar-border` (`neutral-300`) on the shell dividers — sidebar
  edge, topbar, sidebar header — and the lighter `--border` on cards.
- **Dark mode** — elevation by lightness: the sidebar is darkest (`night-950`, `#151515`), the page and
  topbar sit above it (`night-900`, `#1d1d1d`), cards lift off the page (`night-800`, `#2b2b2b`) with
  `#393939` borders, and popovers and menus float above cards (`night-750`). Fills inside a card
  (tags, progress tracks, hover rows) sit a step above the card.

Paint the sidebar with `bg-sidebar` (the `Sidebar` primitive already does) — never `bg-card` or a
one-off colour. Sidebar text pairs (`--sidebar-foreground` on `--sidebar` / `--sidebar-accent`,
`--sidebar-primary-foreground` on `--sidebar-primary`, `--muted-foreground` on `--sidebar`) are
enforced by `tokens-contrast.test.ts`.

## Status badges and icon tiles — meaning, not colour

- **Status pills** use `StatusBadge` (`@workspace/ui/components/status-badge`) with a `StatusTone` —
  `success` (live, usable, approved), `warning` (waiting on someone: a review, an action), `danger`
  (failed, rejected, blocked), `info` (in progress), `neutral` (settled), `muted` (inactive, finished).
  A feature declares one `Record<TheStatus, StatusTone>` (and its labels — never render a raw enum
  value); it never picks badge variants or Tailwind colours itself. Restyling every status in every app
  is a change to `STATUS_TONE_BADGE_VARIANT` alone.
- **Icons beside a stat or a navigation item** sit in an `IconTile` (`@workspace/ui/components/icon-tile`)
  whose `tone` follows what the item is about, consistently across apps: money and active things
  `green`, places `blue`, people and access `violet`, verification and time `teal`, waiting `yellow`,
  ended or blocked `red`, the app's main count `brand`. `StatCard` and `KpiStatCard` (`iconTone`) take
  the tone directly; `KpiDefinition.iconTone` carries it from an analytics definition.
- Never mark a card with a coloured edge stripe (`border-l-4 …`): emphasis comes from the content — a
  toned status badge, the primary action.

## Dark mode toggle implementation

```tsx
// ❌ DON'T — implement a theme toggle with manual class manipulation
// scattered across components, disconnected from the token system
// (07-ui-system.md guidance above)
document.body.classList.toggle('dark'); // called from wherever, inconsistently

// ✅ DO — a single, centralized theme mechanism (e.g. next-themes on
// web), read and toggled from one place, driving the same CSS-variable
// tokens every component already consumes
import { useTheme } from 'next-themes';
function ThemeToggle(): JSX.Element {
  const { theme, setTheme } = useTheme();
  return <Switch checked={theme === 'dark'} onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')} />;
}
```

Respect the user's OS-level preference (`prefers-color-scheme`) as the default before any explicit choice, and persist an explicit choice once made (this is exactly the kind of state Zustand's `persist` middleware, covered above, is actually meant for).

## Focus trapping in dialogs/modals

```tsx
// ❌ DON'T — a custom modal with no focus management at all; a keyboard
// user can Tab straight out of the modal into content behind it, which
// is both confusing and a real accessibility failure
function Modal({ children }: Props) {
  return <div role="dialog">{children}</div>; // focus is never moved into it, never trapped
}

// ✅ DO — use the design system's underlying primitive (Radix/shadcn's
// Dialog already handles this correctly) rather than a hand-rolled
// modal; if a custom one is genuinely necessary, focus is moved into it
// on open, trapped within it while open, and restored to the triggering
// element on close
```

## Form layout patterns

```tsx
// ❌ DON'T — every form in the app laid out slightly differently,
// with inconsistent label placement, spacing, and error-message
// positioning decided ad hoc per form
<div style={{ marginBottom: 12 }}><label>Email</label><input /></div>
<div style={{ marginTop: 20 }}><label>Name</label><input /></div>

// ✅ DO — a shared FormField wrapper/layout primitive, so every form in
// the app has consistent label placement, spacing (from the token
// scale), and error-message positioning, with individual forms only
// supplying the field-specific content
<FormField label="Email" error={emailError}><Input /></FormField>
<FormField label="Name" error={nameError}><Input /></FormField>
```

## Spacing scale — concrete values, not arbitrary ones

```text
❌ DON'T — margins/paddings picked freehand per component: 13px here,
   17px there, 22px somewhere else, with no underlying system.

✅ DO — a defined spacing scale (e.g. a 4px base unit: 4, 8, 12, 16, 24,
   32, 48, 64), expressed as Tailwind spacing tokens, used EVERYWHERE —
   so any two components in the app that are "supposed" to look
   consistent actually do, by construction, rather than by someone
   eyeballing it correctly every time.
```

## Controlled vs uncontrolled components — pick one, deliberately

```tsx
// ❌ DON'T — a component that's ambiguously BOTH controlled and
// uncontrolled at once (accepts a `value` prop AND maintains its own
// internal state that can drift from it), which produces confusing bugs
// where the displayed value and the prop silently disagree
function Toggle({ value }: { value?: boolean }) {
  const [internal, setInternal] = useState(value ?? false);
  return <Switch checked={internal} onChange={() => setInternal(!internal)} />; // never reacts to a LATER change to the `value` prop
}

// ✅ DO — fully controlled (per this document's core philosophy above:
// stateless, controlled by the parent), with no internal state duplicating the prop
function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return <Switch checked={value} onChange={() => onChange(!value)} />;
}
```

If an uncontrolled variant is genuinely useful for a specific low-stakes case (a component nobody needs to control externally), that's a deliberate, separate, clearly-named variant/mode — not an accidental hybrid.

## Error message content — specific and actionable, not generic

```tsx
// ❌ DON'T
<span>Error occurred</span>
<span>Invalid input</span>

// ✅ DO — specific enough that the user knows what to actually do next
<span>Email address is required</span>
<span>Password must be at least 8 characters</span>
```

This connects directly to `05-contracts-zod-api.md`'s custom-error-message guidance — the zod schema is where these specific messages should be authored once, flowing through to both the form UI and any server-returned validation error, rather than the frontend inventing its own separate, possibly-inconsistent wording.

## Placeholder text is not a label

```tsx
// ❌ DON'T — placeholder text as the ONLY indication of what a field is
// for; it disappears the moment the user starts typing, and is not
// reliably announced by every screen reader the same way a real label is
<input placeholder="Email address" />

// ✅ DO — a real, persistent, associated label; placeholder text (if
// used at all) is supplementary, showing an example FORMAT, not the
// field's only identification
<label htmlFor="email">Email address</label>
<input id="email" placeholder="you@example.com" />
```

## Token taxonomy

```text
Primitive tokens  — raw scales, never used directly by components
                    (--gray-900, --blue-500, --space-4, --radius-2)
Semantic tokens   — meaning, what components consume
                    (--background, --foreground, --primary, --destructive, --muted, --border, --ring)
Component tokens  — optional, only when a component needs its own knob
                    (--button-radius, --table-row-height)
```

```text
❌ DON'T — a component referencing a primitive (bg-blue-500): it can't theme,
   and dark mode needs a second hardcoded value.
✅ DO — components reference SEMANTIC tokens only (bg-primary); dark mode remaps
   the semantic token's underlying primitive in one place.
```

## Typography scale

Define a closed scale (e.g. `text-xs, sm, base, lg, xl, 2xl, 3xl`) with paired line-heights and weights, and use only those. A component that needs "a bit bigger than sm but smaller than base" means the scale is wrong or the design is — raise it, don't invent `text-[15px]`.

## Z-index scale

```text
❌ z-[9999], z-[100000], "just make it higher" — an arms race nobody can reason about.
✅ A named scale in tokens: base 0 · dropdown 10 · sticky 20 · overlay 30 · modal 40 · popover 50 · toast 60.
   Every floating element uses a named layer; nobody types a raw number.
```

## Component API checklist (run for every new primitive)

- [ ] Props typed; generic where data varies (`<TData>`), no `any`/`unknown`
- [ ] `variant` / `size` / `state` via CVA; defaults declared
- [ ] Ref forwarded (if wraps a DOM primitive); `displayName` set
- [ ] `onChange` / `onBlur` / `onFocus` contract (where interactive)
- [ ] Fully controlled; no internal state duplicating a prop
- [ ] No hardcoded copy, options, or business logic; everything via props/config
- [ ] Tokens only — no raw colors/spacing/px
- [ ] Light + dark verified; responsive verified; reduced motion respected
- [ ] Keyboard + screen reader verified; visible focus; accessible name
- [ ] Loading / empty / error / disabled states designed
- [ ] `memo`'d where props are stable; no inline object/array/function props at call sites
- [ ] Unit tests (props → output, events → callbacks) + a usage example in its doc/story
- [ ] Documented in the package README (what it's for, what it's not for)

## Do / Don't: composition over configuration

```tsx
// ❌ DON'T — a "smart-ish" primitive that decides what to render from a domain enum
<Badge type="order-status" value="shipped" />       // knows about orders!

// ✅ DO — the primitive renders; the feature maps domain → presentation
<Badge variant={ORDER_STATUS_CONFIG[status].variant}>{ORDER_STATUS_CONFIG[status].label}</Badge>
```
