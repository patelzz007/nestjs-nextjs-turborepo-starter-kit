## Installation

`Diagram` ships with the kit in `packages/ui-native/src/components/diagram.tsx`; there is nothing to install.

```showcase-example
c-diagram-1
```

## Usage

```tsx
import { Diagram } from "@workspace/ui-native/components/diagram";
```

```tsx
<Diagram source={mermaid} caption="From pull request to production" />
```

## API Reference

```showcase-api

```

## Accessibility

- The drawing is an image named by its accTitle and accDescr (or the caption).
- A source that cannot be drawn is announced as an alert.
