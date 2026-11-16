## When to use

- Help and FAQ sections where each question opens its own answer
- Settings, plans, product details and onboarding steps grouped into sections that expand on demand
- Lists of people or records that open to show detail, such as team members and roles

## When not to use

- One block of extra content shown and hidden by a single trigger: use [Collapsible](/components/collapsible)
- Switching between views of the same space where exactly one is always shown: use [Tabs](/components/tabs)

## Notes

- One item opens at a time unless `multiple` is set; `value` and `defaultValue` are always arrays
- A closed panel renders no content, so its text is not in the server HTML: keep essential copy outside, or opened by default
- The `ref` exposes `expand`, `collapse`, `toggle`, `expandAll` and `collapseAll`, for opening an item from elsewhere, such as a link to one question

## Accordion: sections that expand

`Accordion` is a stack of `AccordionItem`s, each with a trigger that opens its panel. Built on Base UI's accordion, it animates the panel's height, keeps one item open (or several, with `multiple`), and moves between triggers with the arrow keys.

### What is Accordion?

A way to put a lot of content in a little space while keeping every heading visible: an FAQ, a settings page in sections, the steps of a setup.

### Why use Accordion?

People scan the headings and open only what they need. Long pages become short, and the structure stays obvious.

### Accordion features

- **Single or multiple.** One open item, or `multiple`.
- **Controlled or uncontrolled.** `value` / `onValueChange`, or `defaultValue`.
- **Animated height.** Measured, so content of any height animates smoothly.
- **Imperative handle.** `expand`, `collapse`, `toggle`, `expandAll` and `collapseAll` through the `ref`.
- **Disabled items.** `disabled` on an item.

## Integrating with other components

Put an accordion in a [Card](/components/card) or a [Frame](/components/frame), add a [Badge](/components/badge) or an icon to triggers, and nest accordions for sub-sections. The showcase's own FAQs use it.

## Frequently asked questions

### Accordion or Tabs?

Tabs show exactly one view at a time and suit peer views; an accordion lets people open none, one or several sections and suits long content read top to bottom.

### Can several items be open?

Yes: pass `multiple`.

### How do I open an item from a link?

Control `value`, or call `expand(value)` on the accordion's `ref`.

### Is it accessible?

Each trigger is a button with `aria-expanded` controlling its panel; the arrow keys, Home and End move between triggers.
