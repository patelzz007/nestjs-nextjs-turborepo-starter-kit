## Installation

`AlertDialog` ships with the kit in `packages/ui-native/src/components/alert-dialog.tsx`; there is nothing to install.

```showcase-example
c-alert-dialog-1
```

## Usage

```tsx
import { AlertDialog } from "@workspace/ui-native/components/alert-dialog";
```

```tsx
<AlertDialog
	visible={open}
	title="Delete project?"
	description="It cannot be undone."
	confirmLabel="Delete"
	cancelLabel="Cancel"
	onConfirm={remove}
	onCancel={close}
	destructive
/>
```

## With media

```showcase-example
c-alert-dialog-3
```

```showcase-example
c-alert-dialog-8
```

## Extra content

```showcase-example
c-alert-dialog-10
```

```showcase-example
c-alert-dialog-14
```

## Action layouts

```showcase-example
c-alert-dialog-2
```

```showcase-example
c-alert-dialog-13
```

## API Reference

```showcase-api

```

## Accessibility

- The card is announced as an alert dialog, so screen readers say it needs a decision.
- The title is a header; the buttons are named by their actions.
- An error is shown as an alert and announced.
