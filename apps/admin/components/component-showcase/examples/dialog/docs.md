## Installation

The dialog parts ship with the kit in `packages/ui/src/components/dialog.tsx`, built on Base UI's dialog; there is nothing to install.

```showcase-example
c-dialog-1
```

## Usage

```tsx
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@workspace/ui/components/dialog";
```

```tsx
<Dialog>
	<DialogTrigger render={<Button variant="outline" />}>Edit profile</DialogTrigger>
	<DialogContent>
		<DialogHeader>
			<DialogTitle>Edit profile</DialogTitle>
			<DialogDescription>Changes are saved when you press Save.</DialogDescription>
		</DialogHeader>
		{/* the form */}
		<DialogFooter>
			<DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
			<Button type="submit">Save</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>
```

## Examples

### Scrollable content

```showcase-example
c-dialog-2
```

### Sticky footer

```showcase-example
c-dialog-3
```

### Full screen

```showcase-example
c-dialog-6
```

### Keyboard shortcuts

```showcase-example
c-dialog-9
```

## API Reference

```showcase-api

```

## Keyboard

| Key               | Action                              |
| :---------------- | :---------------------------------- |
| `Esc`             | Closes the dialog.                  |
| `Tab` `Shift Tab` | Moves focus within the dialog only. |

## Accessibility

- `role="dialog"` with `aria-modal`, named by `DialogTitle` and described by `DialogDescription` — always include a title, visually hidden if need be.
- Focus moves into the dialog, is trapped while it is open, and returns to the trigger when it closes.
