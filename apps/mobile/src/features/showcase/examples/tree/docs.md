## Installation

`Tree` ships with the kit in `packages/ui-native/src/components/tree.tsx`; there is nothing to install.

```showcase-example
c-tree-1
```

## Usage

```tsx
import { Tree, type TreeNode } from "@workspace/ui-native/components/tree";
```

```tsx
<Tree items={ITEMS} defaultExpanded={["src"]} selected={selected} onSelect={setSelected} />
```

## Guides and glyphs

```showcase-example
c-tree-3
```

```showcase-example
c-tree-5
```

## People

```showcase-example
c-tree-6
```

## Checkboxes

```showcase-example
c-tree-7
```

## API Reference

```showcase-api

```

## Accessibility

- Each row is a button that says whether its branch is expanded, and whether it is selected.
- Checkboxes are named "Allow <row>" and report a mixed state for a partly ticked branch.
- Guide lines are hidden from screen readers.
