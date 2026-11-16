## When to use

- Answers people look up one at a time: an FAQ, help topics
- Grouped settings or details that would make a screen too long
- A setup checklist, one step open at a time

## When not to use

- Content everyone must read: show it
- One section on its own: use [Collapsible](/showcase/collapsible)
- Switching between views of one thing: use [Tabs](/showcase/tabs)

## Notes

- `type="single"` keeps one section open (`collapsible` lets it close again); `type="multiple"` opens each on its own
- Closed sections are not rendered, so screen readers do not wander into them
- Sections fade in; Reduce Motion turns that off

## Accordion: stacked sections that open and close

`Accordion` holds `AccordionItem`s, each with an `AccordionTrigger` and an `AccordionContent`.

### What is it?

A controlled set of collapsible sections: `value` (the open ids) in, `onChange` out.

### Why use it?

It keeps a long page short and lets people open just what they need.

### Features

- **Single or multiple.** `type` and `collapsible`.
- **Looks.** Divided rows, separate cards, or one outlined box.
- **Rich triggers.** A leading tile or avatar, a description, a trailing badge.
- **Indicators.** A chevron, a plus and minus, or a chevron at the start that turns.
- **Disabled items.** Locked sections that cannot open.

## Integrating with other components

Triggers take an [IconTile](/showcase/icon-tile), an [Avatar](/showcase/avatar) or a [Badge](/showcase/badge); content takes anything, including a nested accordion.

## Frequently asked questions

### Can several sections be open?

Yes: `type="multiple"`.

### How do I open a section from code?

`value` is yours: add its id.
