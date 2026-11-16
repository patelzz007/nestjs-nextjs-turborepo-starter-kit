## Installation

The resizable parts ship with the kit in `packages/ui/src/components/resizable.tsx`, built on `react-resizable-panels`, already installed.

```showcase-example
c-resizable-1
```

## Usage

```tsx
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@workspace/ui/components/resizable";
```

```tsx
<ResizablePanelGroup orientation="horizontal" className="min-h-64 rounded-lg border">
	<ResizablePanel defaultSize="30%" minSize="20%">
		Files
	</ResizablePanel>
	<ResizableHandle withHandle />
	<ResizablePanel defaultSize="70%">Editor</ResizablePanel>
</ResizablePanelGroup>
```

## Examples

### Vertical

```showcase-example
c-resizable-2
```

### Mixed directions

```showcase-example
c-resizable-3
```

### Three panels

```showcase-example
c-resizable-9
```

### Size tracking

```showcase-example
c-resizable-10
```

## API Reference

```showcase-api

```

## Keyboard

| Key               | Action                              |
| :---------------- | :---------------------------------- |
| `Tab`             | Moves focus to a handle.            |
| `←` `→` / `↑` `↓` | Moves the focused handle.           |
| `Home` `End`      | Moves it to its minimum or maximum. |

## Accessibility

- Each handle is a focusable `separator` exposing its orientation and value.
