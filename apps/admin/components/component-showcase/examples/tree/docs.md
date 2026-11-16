## Installation

The tree parts ship with the kit in `packages/ui/src/components/tree.tsx`, built on `@headless-tree/core` and `@headless-tree/react`, already installed.

```showcase-example
c-tree-1
```

## Usage

```tsx
import { syncDataLoaderFeature, hotkeysCoreFeature, selectionFeature } from "@headless-tree/core";
import { useTree } from "@headless-tree/react";

import { Tree, TreeItem, TreeItemLabel } from "@workspace/ui/components/tree";
```

```tsx
const tree = useTree<Folder>({
	rootItemId: "root",
	getItemName: (item) => item.getItemData().name,
	isItemFolder: (item) => item.getItemData().children !== undefined,
	dataLoader: { getItem: (id) => FOLDERS[id], getChildren: (id) => FOLDERS[id]?.children ?? [] },
	features: [syncDataLoaderFeature, selectionFeature, hotkeysCoreFeature],
});

<Tree tree={tree} indent={20}>
	{tree.getItems().map((item) => (
		<TreeItem key={item.getId()} item={item}>
			<TreeItemLabel />
		</TreeItem>
	))}
</Tree>;
```

## Examples

### Indent lines

```showcase-example
c-tree-2
```

### Folder and file icons

```showcase-example
c-tree-3
```

### File explorer

```showcase-example
c-tree-5
```

### Permissions

```showcase-example
c-tree-7
```

## API Reference

```showcase-api

```

## Keyboard

| Key             | Action                                       |
| :-------------- | :------------------------------------------- |
| `↑` `↓`         | Moves between visible items.                 |
| `→`             | Opens a folder, or moves to its first child. |
| `←`             | Closes a folder, or moves to its parent.     |
| `Home` `End`    | Moves to the first or last item.             |
| `Enter` `Space` | Selects the focused item.                    |

## Accessibility

- `role="tree"` with `treeitem`s exposing `aria-expanded`, `aria-level`, `aria-setsize` and selection.
- Focus roves inside the tree, so it is a single tab stop.
