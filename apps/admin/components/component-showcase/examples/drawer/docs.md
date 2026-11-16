## Installation

The drawer parts ship with the kit in `packages/ui/src/components/drawer.tsx`, built on Base UI's drawer; there is nothing to install.

```showcase-example
c-drawer-1
```

## Usage

```tsx
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger } from "@workspace/ui/components/drawer";
```

```tsx
<Drawer showSwipeHandle>
	<DrawerTrigger render={<Button variant="outline" />}>Filters</DrawerTrigger>
	<DrawerContent>
		<DrawerHeader>
			<DrawerTitle>Filters</DrawerTitle>
			<DrawerDescription>Narrow the list.</DrawerDescription>
		</DrawerHeader>
		{/* the body */}
		<DrawerFooter>
			<DrawerClose render={<Button variant="outline" />}>Close</DrawerClose>
		</DrawerFooter>
	</DrawerContent>
</Drawer>
```

## Examples

### Right side

```showcase-example
c-drawer-2
```

### All sides

```showcase-example
c-drawer-5
```

## API Reference

```showcase-api

```

## Accessibility

- A modal dialog named by `DrawerTitle`; focus is trapped while open and returns to the trigger.
- Swiping is never the only way out: Escape and a close button close it too.
