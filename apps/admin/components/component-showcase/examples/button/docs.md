## Installation

`Button` ships with the kit in `packages/ui/src/components/button.tsx`; there is nothing to install. It is built on Base UI's button primitive and uses the kit's `Spinner` for its loading state.

```showcase-example
c-button-1
```

## Usage

```tsx
import { Button } from "@workspace/ui/components/button";
```

```tsx
<Button>Save changes</Button>
<Button variant="outline">Cancel</Button>
<Button type="submit" loading={isSaving}>
	Publish
</Button>
```

`buttonVariants` returns the same classes for an element that cannot be a `Button`, such as a Next.js `Link` you style directly:

```tsx
<Link href="/components" className={buttonVariants({ variant: "outline", size: "sm" })}>
	Showcase
</Link>
```

## Variants and sizes

`variant` sets the weight — `default`, `secondary`, `outline`, `ghost`, `destructive`, `link` or `nav` — and `size` the height: `xs`, `sm`, `default`, `md` or `lg` for text buttons, and `icon-xs`, `icon-sm`, `icon` or `icon-lg` for square, icon-only ones.

```showcase-example
c-button-3
```

```showcase-example
c-button-11
```

## Icons

Put a Lucide icon before or after the label. Marking it `data-icon="inline-start"` or `data-icon="inline-end"` tightens the padding on that side, so the icon and the text sit evenly.

```showcase-example
c-button-14
```

## States

`loading` shows a spinner and disables the button; `disabled` removes it from interaction; `aria-invalid` adds the destructive ring, for a control a form has rejected.

```showcase-example
c-button-13
```

```showcase-example
c-button-15
```

## As a link

Pass the link through `render` and set `nativeButton={false}`, so Base UI renders an anchor rather than a `button`:

```showcase-example
c-button-27
```

## API Reference

```showcase-api

```

## Accessibility

- `Button` renders a native `button` with `type="button"`: Enter and Space press it, and it never submits a form unless you set `type="submit"`.
- `loading` and `disabled` both disable the button, so it leaves the tab order; the spinner is `aria-hidden`, so change the label if the wait needs announcing.
- An icon-only button needs an `aria-label`. Its focus ring comes from `focus-visible`, so it shows for keyboard users and not on a mouse click.
