## Installation

The command parts ship with the kit in `packages/ui/src/components/command.tsx`, built on the kit's headless `packages/ui/src/components/command-primitive.tsx`; there is nothing to install.

```showcase-example
c-command-1
```

## Usage

```tsx
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator, CommandShortcut } from "@workspace/ui/components/command";
```

```tsx
<Command label="Commands">
	<CommandInput placeholder="Type a command or search…" />
	<CommandList>
		<CommandEmpty>No results found.</CommandEmpty>
		<CommandGroup heading="Pages">
			<CommandItem value="dashboard" onSelect={() => router.push("/")}>
				Dashboard
			</CommandItem>
		</CommandGroup>
		<CommandSeparator />
		<CommandGroup heading="Settings">
			<CommandItem value="profile" keywords={["account"]} onSelect={openProfile}>
				Profile <CommandShortcut>⌘P</CommandShortcut>
			</CommandItem>
		</CommandGroup>
	</CommandList>
</Command>
```

For a ⌘K palette, wrap the same parts in `CommandDialog` with `open` and `onOpenChange`.

## Examples

### Shortcuts

```showcase-example
c-command-2
```

### Groups

```showcase-example
c-command-3
```

### File search

```showcase-example
c-command-5
```

### Action palette

```showcase-example
c-command-7
```

## API Reference

```showcase-api

```

## Keyboard

| Key          | Action                                  |
| :----------- | :-------------------------------------- |
| Typing       | Filters the items.                      |
| `↑` `↓`      | Moves the highlight.                    |
| `Home` `End` | Moves to the first or last item.        |
| `Enter`      | Runs the highlighted item's `onSelect`. |
| `Esc`        | Closes a `CommandDialog`.               |

## Accessibility

- The input is a `combobox` controlling a `listbox` of `option`s; focus stays in the input and the highlight is exposed with `aria-activedescendant`.
- `label` on `Command` names the list (and the input, unless it has its own `aria-label`).
