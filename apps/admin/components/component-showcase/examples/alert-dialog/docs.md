## Installation

The alert dialog parts ship with the kit in `packages/ui/src/components/alert-dialog.tsx`, built on Base UI's alert dialog; there is nothing to install. Its strings come from the `alertDialog` labels.

```showcase-example
c-alert-dialog-1
```

## Usage

```tsx
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@workspace/ui/components/alert-dialog";
```

```tsx
<AlertDialog>
	<AlertDialogTrigger render={<Button variant="destructive" />}>Delete project</AlertDialogTrigger>
	<AlertDialogContent severity="destructive">
		<AlertDialogHeader>
			<AlertDialogTitle>Delete this project?</AlertDialogTitle>
			<AlertDialogDescription>Its pages and history are removed for everyone.</AlertDialogDescription>
		</AlertDialogHeader>
		<AlertDialogFooter>
			<AlertDialogCancel>Cancel</AlertDialogCancel>
			<AlertDialogAction severity="destructive" onConfirm={deleteProject} confirmLoading={isDeleting}>
				Delete
			</AlertDialogAction>
		</AlertDialogFooter>
	</AlertDialogContent>
</AlertDialog>
```

## Examples

### With an icon

```showcase-example
c-alert-dialog-3
```

### Destructive delete

```showcase-example
c-alert-dialog-5
```

### Account deactivation

```showcase-example
c-alert-dialog-8
```

### Unsaved changes

```showcase-example
c-alert-dialog-9
```

### Security audit

```showcase-example
c-alert-dialog-14
```

## API Reference

```showcase-api

```

## Keyboard

| Key               | Action                                        |
| :---------------- | :-------------------------------------------- |
| `Esc`             | Cancels.                                      |
| `Tab` `Shift Tab` | Moves focus within the dialog only.           |
| `confirmShortcut` | Confirms, when set and the action is enabled. |

## Accessibility

- `role="alertdialog"` with `aria-modal`, named by its title and described by its description.
- Focus moves into the dialog and stays there until it is answered; a backdrop click does not dismiss it. `actionOrder` decides which button comes first.
- A countdown and a required confirmation keep the action disabled, and say why in text.
