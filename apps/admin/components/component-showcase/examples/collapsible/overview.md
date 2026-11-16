## When to use

- Cards and panels that hold back secondary detail, such as order items, a usage breakdown or a profile
- Optional settings, advanced form fields and single help answers kept closed until asked for
- Nested navigation menus and file trees, built by placing one collapsible inside another

## When not to use

- Several stacked sections that open and close as one group: use [Accordion](/components/accordion)
- A large folder hierarchy moved through with the arrow keys: use [Tree](/components/tree)

## Notes

- The trigger's `aria-expanded` carries the open state and stays scoped when collapsibles nest: key a chevron's rotation on it
- A closed panel renders none of its children, so that text is missing from the server HTML
- `CollapsibleTrigger` swaps its element through `render`

## Collapsible: show and hide one section

`Collapsible` hides a section behind a trigger and animates it open. It is built on Base UI's collapsible: the trigger is a button with `aria-expanded`, and the panel's height animates smoothly however tall it is.

### What is Collapsible?

The smallest disclosure: one trigger, one panel. "Show advanced settings", "3 more items", a card's details.

### Why use Collapsible?

It keeps the common path short while leaving everything one click away, without the structure of an accordion.

### Collapsible features

- **Controlled or uncontrolled.** `open` / `onOpenChange`, or `defaultOpen`.
- **Animated height.**
- **Nestable.** Collapsibles inside collapsibles for menus and trees.

## Integrating with other components

Put one in a [Card](/components/card) for its details, use a [Button](/components/button) as the trigger (`render`), and nest them for a [Sidebar](/components/sidebar) sub-menu.

## Frequently asked questions

### Collapsible or Accordion?

A collapsible for one independent section; an [Accordion](/components/accordion) for a set of sections managed together.

### How do I rotate a chevron when it opens?

Style the icon on the trigger's state: `[&[aria-expanded=true]>svg]:rotate-180` (or `data-panel-open`).

### Is it accessible?

The trigger is a button with `aria-expanded` and `aria-controls` pointing at the panel.
