# @workspace/ui-native — the React Native UI kit

The low-level components every mobile app in this repository is built from. It is the React Native
twin of the web kit, `@workspace/ui` (packages/ui). Wherever a web component has a mobile
counterpart, both kits use **the same name**, so both platforms share one vocabulary (`Alert`,
`StatusBadge`, `AlertDialog`, `Tabs`, …). Apps import components one file at a time:

```ts
import { Button } from "@workspace/ui-native/components/button";
import { resolveControlState } from "@workspace/ui-native/lib/control-state";
```

The kit has no business knowledge. A component never fetches, never decides what a value
*means*, never hardcodes a product label and never validates input. The screen (the smart
component) owns data, transformations, validation (zod via TanStack Form or React Hook Form) and
state, and passes everything down.

## The contract every component meets

`packages/tooling/tests/ui-native-kit-contract.test.mjs` checks the mechanical parts of this list for
every file in `src/components/`. It lives in the tooling package because it reads source files with Node,
which the kit's own React Native lint rules forbid.

1. **Stateless and controlled.** The value comes in as a prop and changes go out through
   events. The only state a component may hold is display state that no caller needs to own: a
   sheet's open flag, a press highlight, a calendar's visible month. It is reset when the
   component remounts.
2. **Ref forwarding (mandatory).** Every exported component is `React.forwardRef`. The ref
   reaches the underlying native element (`View`, `TextInput`, `Pressable`, `ScrollView`), so
   forms can focus it, scroll to it and measure it.
3. **The standard event contract.** Inputs expose `onChange(value)`, `onBlur()` and
   `onFocus()`: the RN `onChangeText` / `onValueChange` map onto `onChange`. Pressables expose
   `onPress`, plus `onFocus` / `onBlur`. Do not invent `onValueSet`-style names.
4. **One variant system: CVA.** Every component styles itself through
   `class-variance-authority` with the axes `variant`, `size` and `state`. `state` is
   `"default" | "loading" | "disabled" | "error"`, derived only by `resolveControlState({
   disabled, loading, invalid })` (`src/lib/control-state.ts`, the same precedence as the web
   kit's `resolveFieldState`). Export the CVA function (`buttonVariants`) and the variant types.
   A purely structural component (`Separator`, `AspectRatio`) still exposes `variant` / `size`
   where they make sense, and `state` wherever it can be disabled, busy or invalid.
5. **Form integration ready.** Inputs take `value`, `onChange`, `onBlur`, `invalid` (or an
   `error` message) and `disabled`, and forward their ref. They plug straight into a TanStack
   Form `field` or a React Hook Form `Controller` with no adapter. A component never runs
   validation. It renders the message it is given.
6. **Design tokens only.** Colours, radii, spacing and type come from token utilities
   (`bg-card`, `text-muted-foreground`, `rounded-lg`, `accent-primary` for icon colours). No
   arbitrary values (`w-[13px]`, `bg-[#fff]`), no hex or rgb colours, no `style={{ … }}` object
   literals. An animated style from Reanimated (`style={animatedStyle}`) is the one exception.
   Fonts use the family utilities (`font-sans`, `font-sans-semibold`, …), never
   `font-medium` / `font-semibold` / `font-bold` (rules/04).
7. **Light and dark themes for free.** Because only semantic tokens are used, both themes work
   with no `dark:` variants. Do not branch on the theme in a component.
8. **Optimized by default.**
   - `React.memo` around every exported component.
   - `React.useCallback` for handlers passed down.
   - `React.useMemo` for derived objects and arrays passed as props, such as
     `accessibilityState`.
   - No object or array literals created inline in JSX props: hoist constants to module scope.
9. **Accessible.**
   - Every pressable has an `accessibilityRole` and an accessible name.
   - Selection, disabled, busy, expanded and checked states go through `accessibilityState`.
   - Touch targets are at least 44 pt, using `hitSlop` where the visual is smaller.
   - Motion respects Reduce Motion (`src/lib/use-reduce-motion.ts`).
10. **Composable.**
    - Every component accepts `className`, merged last with `cn()`, so callers control layout.
    - Multi-part components export their parts (`Card`, `CardHeader`, `CardTitle`, …), as the
      web kit does.
    - Content is passed as `children` or as typed props, never as hardcoded copy. Any default copy
      is generic and overridable ("Close", never "Close reward").
11. **Tested.** Each component has `src/components/__tests__/<name>.test.tsx` (jest-expo +
    `@testing-library/react-native`). It covers:
    - its role and accessible name;
    - its controlled value and events;
    - `state` precedence;
    - ref forwarding;
    - `className` merging;
    - each variant it adds.

`Button` (`src/components/button.tsx`) is the reference implementation: copy its shape.

## Web ↔ native map

| Web (`@workspace/ui`) | Native (`@workspace/ui-native`) |
| --- | --- |
| `Sheet`, `Drawer` | `BottomSheet` (`Sheet` and `Drawer` slide up from the bottom on a phone) |
| `DropdownMenu`, `ContextMenu`, `Popover` | `DropdownMenu`: an action sheet of choices |
| `Tooltip`, `HoverCard` | `Tooltip`: shown on long-press, since there is no hover on a phone |
| `Select` | `SelectField` |
| `Combobox`, `Command` | `Combobox` (search inside the sheet) |
| `DataTable`, `Table` | `Table` |
| `Label` | `Label` in `text.tsx`, beside the other text roles (no separate `label.tsx`) |
| `UserAvatar`, `EntityAvatar` | `Avatar` with `shape="circle"` / `shape="rounded"` |
| `Calendar`, `DatePicker`, `MultiDatePicker` | `CalendarNavigator` + `CalendarMonthGrid`, `DateField`, `MultiDateField`, `DateRangePicker` |

**Web only, with no mobile counterpart** (desktop or app-shell patterns):

- App shell: `app-*`, `panel-*`, `sidebar*`, `app-command-palette`.
- Desktop patterns: `menubar`, `navigation-menu`, `resizable`, `scroll-to-top`, `kbd`,
  `breadcrumb`.
- Web infrastructure: `redux-devtools-guard`, `theme-provider`, `shell-theme-toggle`,
  `layout-transition`, `ui-kit-labels-provider`.

## Seeing every component

The mobile app's **Settings → Components** screen (drawer: Developer → Components,
`apps/mobile/src/app/(app)/settings/components.tsx`) shows every kit component live, one family at a
time. The web kit's twin is the admin's `/components` page.

On iOS only one `Modal` can be presented at a time. A `DropdownMenu` item that opens an
`AlertDialog` or a `Dialog` must wait for the menu's sheet to close first.

## Hermes

The kit runs on Hermes, which lacks `Intl.RelativeTimeFormat`, `ListFormat`, `PluralRules`,
`DisplayNames`, `Segmenter` and `Locale`. Jest (Node) has them, so a unit test passes where a
device would crash. `packages/tooling/tests/hermes-intl.test.mjs` blocks them (rules/04).

## Tests and tooling

- `pnpm --filter @workspace/ui-native test`: jest-expo, the same runner as `apps/mobile`
  (ADR 031). Tests live in `__tests__/` folders (rules/11).
- `lint`, `typecheck` and `format`, as in every workspace.
- Apps that use the kit add `@source "../../packages/ui-native/src";` to their Uniwind
  stylesheet (as `apps/mobile/global.css` does). Without it, Tailwind never sees the kit's
  classes, and the components render unstyled on a device.
- Native modules the kit imports (Reanimated, SVG, Uniwind, Expo modules) are **peer
  dependencies**: the app provides the one copy. The app's Metro config lists them as
  singletons.
