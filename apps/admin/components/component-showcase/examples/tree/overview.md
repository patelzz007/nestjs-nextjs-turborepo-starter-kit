## When to use

- Folder and file explorers for a code project, a workspace or a document store
- Record hierarchies such as accounts and contacts, or an org chart of who reports to whom
- Role-permission editors grouped by area, where each action is ticked on or off

## When not to use

- Picking one value from a nested list inside a popup: use [Cascader](/components/cascader)
- Two or three levels of navigation in a side column: use [Sidebar](/components/sidebar) with sub-menus

## Notes

- The tree's state comes from `@headless-tree/react`'s `useTree`: pass the instance as `tree` and render its items
- The `rootItemId` record is never drawn: its children are the top level
- After adding, moving or removing records behind `dataLoader`, call `tree.rebuildTree()`, or the rows keep the old structure

## Tree: hierarchies to browse and act on

`Tree` renders a hierarchy driven by Headless Tree: expandable rows with indentation, optional guide lines, selection, search, renaming, checkboxes and drag-and-drop. The kit draws the rows; Headless Tree owns the state and the keyboard.

### What is Tree?

The explorer pattern: folders that open, files you select, items you drag between folders. `TreeItem` wraps each row, `TreeItemLabel` draws its label with the toggle, and `TreeDragLine` shows where a drop will land.

### Why use Tree?

Deep hierarchies need a compact, keyboard-friendly view. A tree shows the structure at a glance and scales to thousands of items with Headless Tree's features.

### Tree features

- **Expand and collapse.** With chevrons, plus and minus icons, or folder icons.
- **Indent lines.** Guide lines for each level.
- **Selection and checkboxes.** Single, multiple, or checked with cascading.
- **Drag and drop.** Reorder and move between folders, with a drop line.
- **Search and async.** Headless Tree's search and async data loaders.

## Integrating with other components

Put a tree in a [Sidebar](/components/sidebar) or a [Resizable](/components/resizable) panel beside a [Code Block](/components/code-block) for a file explorer, and use [Checkbox](/components/checkbox)es for a permissions editor.

## Frequently asked questions

### Tree or Cascader?

A tree to browse and act on a hierarchy in the page; a [Cascader](/components/cascader) to pick a value from one into a field.

### How do I load children from a server?

Use Headless Tree's async data loader feature; the sync loader throws when a child is a promise.

### Is it accessible?

Yes: `role="tree"` with `treeitem`s that expose `aria-expanded`, `aria-level` and selection; Headless Tree handles the arrow keys, Home, End and type-ahead.
