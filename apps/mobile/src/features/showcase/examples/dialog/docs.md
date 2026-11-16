## Installation

`Dialog` ships with the kit in `packages/ui-native/src/components/dialog.tsx`; there is nothing to install.

```showcase-example
c-dialog-1
```

## Usage

```tsx
import { Dialog, DialogFooter, DialogHeader, DialogTitle } from "@workspace/ui-native/components/dialog";
```

```tsx
<Dialog open={open} onOpenChange={setOpen}>
	<DialogHeader>
		<DialogTitle>{TITLE}</DialogTitle>
	</DialogHeader>
	<DialogFooter>
		<Button label="Close" onPress={close} />
	</DialogFooter>
</Dialog>
```

## Long content

```showcase-example
c-dialog-3
```

```showcase-example
c-dialog-6
```

## The close button

```showcase-example
c-dialog-5
```

## API Reference

```showcase-api

```

## Accessibility

- The card is a dialog that keeps screen readers inside it while open.
- The title is a header; the corner close button is named "Close".
- The scrim is a "Close" button for touch exploration when the dialog can be dismissed.
