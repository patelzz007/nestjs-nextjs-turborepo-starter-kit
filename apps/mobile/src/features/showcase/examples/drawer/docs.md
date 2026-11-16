## Installation

`Drawer` ships with the kit in `packages/ui-native/src/components/sheet.tsx`; there is nothing to install.

```showcase-example
c-drawer-1
```

## Usage

```tsx
import { Drawer } from "@workspace/ui-native/components/sheet";
```

```tsx
<Drawer open={open} onOpenChange={setOpen} title="Share">
	<Button label="Copy link" onPress={copy} />
</Drawer>
```

## Sides

```showcase-example
c-drawer-5
```

## API Reference

```showcase-api

```

## Accessibility

- The panel keeps screen readers inside it while open; the system back closes it.
- The backdrop is a "Close" button for touch exploration.
- Swiping is never the only way out.
