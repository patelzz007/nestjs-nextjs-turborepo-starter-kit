## Installation

`Sheet` ships with the kit in `packages/ui-native/src/components/sheet.tsx`; there is nothing to install.

```showcase-example
c-sheet-1
```

## Usage

```tsx
import { Sheet } from "@workspace/ui-native/components/sheet";
```

```tsx
<Sheet open={open} onOpenChange={setOpen} title="Edit profile" footer={footer}>
	<TextField label="Name" value={name} onChange={setName} />
</Sheet>
```

## Sides

```showcase-example
c-sheet-3
```

## Long content

```showcase-example
c-sheet-4
```

## API Reference

```showcase-api

```

## Accessibility

- The panel keeps screen readers inside it while open.
- The title is a header; the close button is named "Close <title>".
- The system back closes it.
