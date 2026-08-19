# `@workspace/ui`

Shared, **dumb** UI primitives for the monorepo. Components are stateless, fully controlled by parents, and safe to use with React Hook Form.

## Principles

| Rule | Practice |
|------|----------|
| Smart vs dumb | No data fetching, routing, or `localStorage` in primitives — pages/containers own that logic. |
| `forwardRef` | Every interactive root forwards a ref so RHF `register()` and focus management work. |
| CVA | Styled components use `class-variance-authority` with `variant`, `size`, and `state` (`default` \| `loading` \| `disabled` \| `error`). |
| Labels | No English defaults in dumb components — pass copy via `labels` props or required string props. |
| Tokens | Use design tokens (`bg-primary`, `text-destructive`, `z-overlay`) — no raw `z-50`, `bg-emerald-*`, or hex literals. |
| Types | Zod at boundaries; no `any`, `unknown`, `never`, or runtime `typeof` checks in UI code. |

## Theming

Import global styles once in your app layout:

```tsx
import "@workspace/ui/globals.css";
```

Tokens live in `src/styles/tokens.css`. Z-index layers:

- `z-overlay` — modal / dialog / sheet backdrops
- `z-popover` — dropdowns, selects, tooltips
- `z-toast` — toast stack (above overlays)

Wrap the app with `ThemeProvider` from `@workspace/ui/components/theme-provider` for light/dark mode.

## React Hook Form

`react-hook-form` is an **optional peer** — install it in the app that owns the form:

```bash
pnpm add react-hook-form
```

**`register()`** — primitives forward refs to the native control:

```tsx
const { register } = useForm<LoginInput>({ resolver: zodResolver(LoginInputSchema) });

<Input {...register("email")} aria-invalid={errors.email ? true : undefined} />
```

**`Controller`** — for headless primitives (Select, Combobox, Switch):

```tsx
<Controller
	name="role"
	control={control}
	render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />}
/>
```

**Loading submit** — use `Button` with `loading` or `FormShell` with explicit `submitLabel` / `loadingLabel` (both required).

## Accessibility

- Form controls expose `onBlur`, `onChange`, and `onFocus` without clobbering consumer handlers.
- Error banners use `role="alert"` or `aria-live` where appropriate.
- `Spinner` requires `ariaLabel` via props (no default English label).

## Testing

Contract tests enforce ref forwarding and event composition:

```bash
pnpm --filter @workspace/ui test
```

Files: `form-contract.test.tsx`, `display-contract.test.tsx`, `overlay-contract.test.tsx`, `ui-kit-contract.test.tsx`.

## Package layout

```
src/
  components/
    form/       — inputs, buttons, field shell
    overlay/    — dialog, sheet, popover, …
    navigation/ — sidebar, tabs, pagination, …
    feedback/   — alert, toast, spinner, …
    display/    — table, card, chart, …
  lib/          — utils, field-variants, field-state
  styles/       — tokens, globals
  hooks/
```
