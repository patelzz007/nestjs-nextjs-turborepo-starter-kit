## Installation

The sheet parts ship with the kit in `packages/ui/src/components/sheet.tsx`, built on Base UI's dialog; there is nothing to install.

```showcase-example
c-sheet-1
```

## Usage

```tsx
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@workspace/ui/components/sheet";
```

```tsx
<Sheet>
	<SheetTrigger render={<Button variant="outline" />}>Edit</SheetTrigger>
	<SheetContent side="right">
		<SheetHeader>
			<SheetTitle>Edit merchant</SheetTitle>
			<SheetDescription>Update the merchant's details.</SheetDescription>
		</SheetHeader>
		{/* the form */}
		<SheetFooter>
			<SheetClose render={<Button variant="outline" />}>Cancel</SheetClose>
			<Button type="submit">Save</Button>
		</SheetFooter>
	</SheetContent>
</Sheet>
```

## Examples

### Any side

```showcase-example
c-sheet-3
```

### Scrollable content

```showcase-example
c-sheet-4
```

## API Reference

```showcase-api

```

## Accessibility

- A modal dialog: named by `SheetTitle`, described by `SheetDescription`, focus trapped while open.
- Escape closes it, and focus returns to the trigger.
