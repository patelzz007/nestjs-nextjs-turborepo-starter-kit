## Installation

`Spinner` ships with the kit in `packages/ui-native/src/components/spinner.tsx`; there is nothing to install.

```showcase-example
c-spinner-1
```

## Usage

```tsx
import { LoadingDots, Spinner } from "@workspace/ui-native/components/spinner";
```

```tsx
<Spinner variant="muted" accessibilityLabel="Loading invoices" />
```

## In controls

```showcase-example
c-spinner-2
```

```showcase-example
c-spinner-3
```

```showcase-example
c-spinner-4
```

## Loading views

```showcase-example
c-spinner-5
```

```showcase-example
c-spinner-7
```

```showcase-example
c-spinner-8
```

## Loading dots

```showcase-example
c-spinner-10
```

## Colours

```showcase-example
c-spinner-12
```

## API Reference

```showcase-api

```

## Accessibility

- Each spinner is announced busy, with its label.
- LoadingDots stay still under Reduce Motion.
- Pair a spinner with words where there is room: not everyone reads motion as waiting.
