## Installation

The cascader ships with the kit in `packages/ui/src/components/cascader/`, one file per group of parts; there is nothing to install. Long levels are virtualised with TanStack Virtual, already installed.

```showcase-example
c-cascader-1
```

## Usage

```tsx
import { Cascader, CascaderContent, CascaderEmpty, CascaderList, CascaderPanel, CascaderStatus, CascaderTrigger } from "@workspace/ui/components/cascader/cascader";
import { CascaderItems } from "@workspace/ui/components/cascader/cascader-item";
import { CascaderBreadcrumb, CascaderInput, CascaderNav, CascaderValue } from "@workspace/ui/components/cascader/cascader-nav";
import type { CascaderNode } from "@workspace/ui/components/cascader/cascader-types";
```

```tsx
const ITEMS: CascaderNode[] = [
	{ value: "record-id", label: "Record ID" },
	{
		value: "person",
		label: "Person",
		children: [
			{ value: "person.name", label: "Name" },
			{ value: "person.email", label: "Email addresses" },
		],
	},
];

<Cascader items={ITEMS} value={value} onValueChange={setValue}>
	<CascaderTrigger aria-label="Attribute" render={<Button variant="outline" />}>
		<CascaderValue placeholder="Select an attribute" />
	</CascaderTrigger>
	<CascaderContent className="w-80">
		<CascaderPanel>
			<CascaderNav>
				<CascaderInput />
			</CascaderNav>
			<CascaderBreadcrumb />
			<CascaderEmpty />
			<CascaderList>
				<CascaderItems />
			</CascaderList>
			<CascaderStatus />
		</CascaderPanel>
	</CascaderContent>
</Cascader>;
```

That is the minimum worth shipping. Three parts carry more than their markup: `CascaderInput` owns the level keys (`→`, `←`, `Backspace`), `CascaderValue` resolves a selection whose node is not loaded, and `CascaderStatus` is the panel's only live region.

## Anatomy

```tsx
<Cascader>
	<CascaderTrigger /> {/* or <CascaderChips /> for multiple; omitted with `inline` */}
	<CascaderContent>
		<CascaderPanel>
			<CascaderNav>
				<CascaderBack />
				<CascaderInput />
			</CascaderNav>
			<CascaderBreadcrumb /> {/* drill mode only */}
			<CascaderEmpty />
			<CascaderList>
				<CascaderItems />
			</CascaderList>
			{/* in mode="columns", <CascaderColumns /> replaces the list */}
			<CascaderFooter>
				<CascaderAction />
			</CascaderFooter>
			<CascaderStatus />
		</CascaderPanel>
	</CascaderContent>
</Cascader>
```

Nothing inside the panel is implied: a part left out is simply not drawn. Keep `CascaderFooter` a sibling of the list, never a child, so its actions stay when a search matches nothing.

## Modes

### Columns

```showcase-example
c-cascader-13
```

### Tree

```showcase-example
c-cascader-14
```

### Inline panel

```showcase-example
c-cascader-7
```

## Examples

### Multiple selection with chips

```showcase-example
c-cascader-17
```

### Deep search

```showcase-example
c-cascader-3
```

### Async loading

```showcase-example
c-cascader-15
```

### Virtualised list

```showcase-example
c-cascader-16
```

### Footer flyout

```showcase-example
c-cascader-4
```

### Native form field

```showcase-example
c-cascader-12
```

## API Reference

```showcase-api

```

## Keyboard

| Key             | Action                                                     |
| :-------------- | :--------------------------------------------------------- |
| `↑` `↓`         | Moves the highlight within the level.                      |
| `→`             | Opens the highlighted branch.                              |
| `←` `Backspace` | Goes back a level (Backspace with an empty search).        |
| `Enter`         | Commits the highlighted node, or opens a branch.           |
| `Space`         | In multiple mode, checks or unchecks the highlighted node. |
| `Esc`           | Closes the popup.                                          |

## Accessibility

- The search field controls the list as a combobox, and the highlighted row is exposed through `aria-activedescendant`.
- `CascaderStatus` announces the level, result counts and loading, which a screen reader cannot see in the visual breadcrumb.
- Name the field on the trigger with `aria-labelledby` or `aria-label`; the trigger's text is its value.
