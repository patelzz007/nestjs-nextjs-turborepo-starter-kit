## When to use

- Form fields that commit one value from a nested tree, such as a category, a region, a file or a department
- Picking several nodes at once, such as permissions, report columns or shipping zones, with cascading checks
- Deep or large hierarchies as Miller columns, an expanding tree, an inline panel, or levels fetched on demand

## When not to use

- A short flat list of options with no nesting: use [Select](/components/select)
- A folder hierarchy browsed on the page rather than picked into a field: use [Tree](/components/tree)
- A flat list searched by typing: use [Combobox](/components/combobox)

## Notes

- The parts live in separate files: `CascaderItems` comes from `cascader/cascader-item`, `CascaderInput` and `CascaderValue` from `cascader/cascader-nav`
- Give every node a `value` that is unique across the whole tree, not only within its level: a repeated `value` silently drops the later row
- The trigger shows the field's value, not its name: name the field with a label (`aria-labelledby`) or `aria-label` on the trigger

## Cascader: a select whose options form a tree

`Cascader` is a select for nested options. Instead of scrolling one long list, people drill from a category into its children and commit a value at whatever depth matters. Pressing a branch opens it rather than committing; the popup stays open, and a breadcrumb and a back control say where they are.

### What is Cascader?

A composed picker with four layouts over one tree: **drill** (one level at a time, with a breadcrumb), **columns** (Miller columns, every level side by side), **tree** (an expanding outline) and **inline** (the panel in the page, no popup). Search runs across every level, multiple selection checks whole branches, and levels can load on demand.

### Why use Cascader?

Category trees, attribute pickers, org charts and region lists are hierarchies; flattening them into one list loses the structure and makes the list very long. A cascader keeps each level short and the path visible.

### Cascader features

- **Four modes.** Drill, columns, tree and inline.
- **Single or multiple.** Chips for multiple values, with cascading checks across a branch.
- **Search everywhere.** Matches at any depth, with the path shown.
- **Async and virtualised.** Children loaded on demand; long levels virtualised.
- **Footer actions.** "Create new …" rows and flyout submenus beside the list.
- **Native forms and i18n.** A hidden input for form posts; labels from the `cascader` messages.

## Integrating with other components

Put it in a [Field](/components/field) for its label and error. Use a kit [Button](/components/button) as the trigger (`render`), show people with [Avatar](/components/avatar)s in rows, and colour-code nodes with dots, as the examples do.

## Frequently asked questions

### Cascader or Tree?

Cascader when the hierarchy is a set of options to pick into a field; [Tree](/components/tree) when it is content to browse and act on in the page.

### Can people pick a parent, not only a leaf?

Yes: a node's value can be committed at any depth. In multiple mode, checking a parent checks its whole branch.

### Can it load levels from a server?

Yes: give a node `hasChildren` and load its children when it opens, as the Async Loading example does.

### Does it handle very large trees?

Yes: long levels virtualise (only visible rows render), and search runs over the flattened tree.
