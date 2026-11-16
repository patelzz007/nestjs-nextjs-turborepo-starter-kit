## When to use

- Account, password and settings forms split into panels so only one shows at a time
- Side navigation inside a page, with sections stacked in a column beside the open panel
- Views of one surface, such as dashboard sections, mail folders or stats by period

## When not to use

- Sections people should be able to open several of, or none: use [Accordion](/components/accordion)
- Navigation between pages with their own URLs: use links (a [Navigation Menu](/components/navigation-menu) or a [Sidebar](/components/sidebar))
- A compact choice that filters content rather than switching panels: use [Toggle Group](/components/toggle-group)

## Notes

- Only the active `TabsContent` renders, so other panels ship no server HTML and lose unsaved typed values on a switch: lift form state up
- The arrow keys move focus between tabs and Enter or Space selects (manual activation)

## Tabs: one view at a time

`Tabs` switches between panels of related content from a list of tabs, built on Base UI's tabs. The list scrolls or stacks vertically, an indicator follows the active tab, and the arrow keys move between tabs.

### What is Tabs?

`TabsList` holds `TabsTrigger`s; each opens its `TabsContent`. Two looks — `default` (a segmented pill) and `line` (an underline) — and a vertical orientation for side navigation.

### Why use Tabs?

Tabs keep peer views — Overview, Activity, Settings — in one place and show which is active. They avoid long pages without hiding the existence of the other views.

### Tabs features

- **Two variants.** `default` and `line`.
- **Horizontal or vertical.** `orientation`.
- **Controlled or uncontrolled.** `value` / `onValueChange`, or `defaultValue`.
- **Icons and counts.** Any content in triggers, with [Badge](/components/badge) counts.

## Integrating with other components

Put forms of [Field](/components/field)s in panels, [Badge](/components/badge) counts in triggers, and a [Card](/components/card) around the whole set. The showcase's Preview / Code switch is a line-variant `Tabs`.

## Frequently asked questions

### Tabs or Accordion?

Tabs for peer views, one at a time; an [Accordion](/components/accordion) for long content read top to bottom.

### Should tabs change the URL?

When a view should be shareable or survive a reload, keep the active tab in the URL (`value` from a search param).

### Is it accessible?

Yes: `role="tablist"` with `tab`s and `tabpanel`s; the arrow keys move between tabs, and Enter or Space activates the focused one.
