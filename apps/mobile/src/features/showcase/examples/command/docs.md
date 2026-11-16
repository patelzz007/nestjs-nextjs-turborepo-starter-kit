## Installation

`CommandList` and `CommandPalette` ship with the kit in `packages/ui-native/src/components/command-palette.tsx`; there is nothing to install.

```showcase-example
c-command-1
```

## Usage

```tsx
import { CommandPalette, type CommandPaletteGroup } from "@workspace/ui-native/components/command-palette";
```

```tsx
<CommandPalette visible={open} onClose={close} groups={GROUPS} title="Search" placeholder="Type a command…" emptyMessage="No results." />
```

## Groups

```showcase-example
c-command-3
```

```showcase-example
c-command-4
```

## Rich rows

```showcase-example
c-command-5
```

```showcase-example
c-command-6
```

## API Reference

```showcase-api

```

## Accessibility

- The search box is named by its placeholder.
- Each command is a button named by its label and line, and says when it is disabled.
- Badges and times after a label are decorative: say them in the description when they matter.
