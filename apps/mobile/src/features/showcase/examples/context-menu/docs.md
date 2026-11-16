## Installation

`ContextMenu` ships with the kit in `packages/ui-native/src/components/context-menu.tsx`; there is nothing to install.

```showcase-example
c-context-menu-1
```

## Usage

```tsx
import { ContextMenu } from "@workspace/ui-native/components/context-menu";
```

```tsx
<ContextMenu title="Message" items={ITEMS} onSelect={run}>
	<Bubble text={message} />
</ContextMenu>
```

## Row kinds

```showcase-example
c-context-menu-2
```

```showcase-example
c-context-menu-6
```

```showcase-example
c-context-menu-7
```

## Submenus

```showcase-example
c-context-menu-4
```

## API Reference

```showcase-api

```

## Accessibility

- The area is a button named by `title`, with the hint "Long press for actions".
- A "Show actions" accessibility action opens the menu without the gesture.
- The rows are menu items, checkboxes or radios, with their states.
