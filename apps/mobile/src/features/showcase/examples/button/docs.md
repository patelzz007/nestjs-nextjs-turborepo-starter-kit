## Installation

`Button` ships with the kit in `packages/ui-native/src/components/button.tsx`; there is nothing to install. It is a React Native `Pressable` with the button role, styled with CVA over the design tokens, and uses `ActivityIndicator` for its loading state.

```showcase-example
c-button-1
```

## Usage

```tsx
import { Button } from "@workspace/ui-native/components/button";
```

```tsx
<Button label="Save changes" onPress={save} />
<Button label="Cancel" variant="outline" onPress={cancel} />
<Button label="Publish" loading={isSaving} onPress={publish} />
```

## Variants and sizes

`variant` sets the weight — `primary`, `secondary`, `outline`, `ghost`, `destructive` or `link` — and `size` the height: `xs`, `sm`, `md` or `lg`. `IconButton` is the square, icon-only button, in `xs`, `sm`, `md` and `lg`.

```showcase-example
c-button-3
```

```showcase-example
c-button-11
```

## Glyphs and slots

Put a Lucide glyph before the label with `icon`, or after it with `iconPosition="end"`. `leading` takes an avatar, `trailing` a count, a badge or a shortcut, and `description` a second line.

```showcase-example
c-button-14
```

```showcase-example
c-button-52
```

## States

`loading` shows a spinner and blocks presses; `disabled` takes the disabled fill; `invalid` adds the destructive border, for an action a form has rejected.

```showcase-example
c-button-13
```

```showcase-example
c-button-15
```

## Navigating

A button that goes somewhere calls the router from `onPress`:

```showcase-example
c-button-27
```

## API Reference

```showcase-api

```

## Accessibility

- `Button` has the button role and its `label` as its name (or `accessibilityLabel` when a count or a badge should be read with it); `accessibilityHint` says what happens when the label alone does not.
- `loading` and `disabled` both block presses and are announced (busy, disabled). Change the label too when a long wait needs announcing.
- An icon-only button is an `IconButton` with a `label`. Small sizes keep a 44 pt touch area through `hitSlop`.
