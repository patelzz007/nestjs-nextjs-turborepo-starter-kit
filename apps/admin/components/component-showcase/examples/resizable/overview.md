## When to use

- Split views that set a sidebar beside content, or a header over a body, sized by dragging the divider
- Editor- and IDE-style workspaces of three or more panes, in one row or nested across both directions
- Layouts that read live pane sizes back into app state, such as a percentage readout

## When not to use

- A sidebar that only opens and closes, with no free sizing: use [Sidebar](/components/sidebar)
- Columns of a table people widen at the header edge: [Data Table](/components/data-table) resizes columns itself (`columnControls.resizing`)

## Notes

- A number in `defaultSize` or `minSize` is read as pixels; pass a string such as `"30%"` for a share of the group
- `orientation="vertical"` stacks the panels with horizontal dividers; `horizontal` sets them side by side
- Every `ResizablePanel` and `ResizableHandle` must be a direct child of its group: never wrap one in a `div`

## Resizable: panes people size by dragging

`ResizablePanelGroup` lays out `ResizablePanel`s separated by `ResizableHandle`s, built on `react-resizable-panels`. Dragging a handle — or focusing it and using the arrow keys — redistributes the space, within each panel's minimum and maximum.

### What is Resizable?

The split-pane layout of editors and mail clients: a file tree beside the editor, a list above the preview. Groups nest for layouts in both directions.

### Why use Resizable?

People's screens and tasks differ. Letting them size panes keeps dense tools usable on any screen, and sizes can be remembered.

### Resizable features

- **Horizontal or vertical.** `orientation` on the group.
- **Bounds.** `minSize`, `maxSize` and `defaultSize`, in pixels or percentages.
- **Collapsible panels.** Collapse a panel past its minimum.
- **Handles.** Plain, with a grip (`withHandle`), or custom animated pills.
- **Size events.** Read sizes back to save or display them.

## Integrating with other components

Put a [Tree](/components/tree) in a side panel, a [Code Block](/components/code-block) or an editor in the main one, and a [Menubar](/components/menubar) above. Save the layout to local storage to restore it.

## Frequently asked questions

### How do I give a panel a percentage size?

Pass a string: `defaultSize="30%"`. A plain number means pixels.

### Can people resize with the keyboard?

Yes: the handle is focusable, and the arrow keys move it.

### How do I remember the layout?

Read sizes from the group's layout event, store them, and pass them back as `defaultSize`s.

### Is it accessible?

Each handle is a `separator` with its orientation and value exposed, focusable and moved with the arrow keys.
