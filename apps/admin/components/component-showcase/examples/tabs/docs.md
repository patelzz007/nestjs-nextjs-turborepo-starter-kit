## Installation

The tabs parts ship with the kit in `packages/ui/src/components/tabs.tsx`, built on Base UI's tabs; there is nothing to install.

```showcase-example
c-tabs-1
```

## Usage

```tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs";
```

```tsx
<Tabs defaultValue="account">
	<TabsList>
		<TabsTrigger value="account">Account</TabsTrigger>
		<TabsTrigger value="password">Password</TabsTrigger>
	</TabsList>
	<TabsContent value="account">{/* account form */}</TabsContent>
	<TabsContent value="password">{/* password form */}</TabsContent>
</Tabs>
```

## Examples

### Line variant

```showcase-example
c-tabs-2
```

### Vertical

```showcase-example
c-tabs-3
```

### Badge counts

```showcase-example
c-tabs-7
```

### Segmented control

```showcase-example
c-tabs-9
```

## API Reference

```showcase-api

```

## Keyboard

| Key               | Action                                                       |
| :---------------- | :----------------------------------------------------------- |
| `Tab`             | Moves into the list, to the active tab, then into the panel. |
| `←` `→` / `↑` `↓` | Moves between tabs, by orientation.                          |
| `Home` `End`      | Moves to the first or last tab.                              |
| `Enter` `Space`   | Activates the focused tab.                                   |

## Accessibility

- `role="tablist"` with `tab`s (`aria-selected`) and `tabpanel`s named by their tabs.
