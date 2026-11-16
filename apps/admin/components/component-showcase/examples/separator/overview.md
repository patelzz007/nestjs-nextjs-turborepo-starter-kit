## When to use

- Thin rules between a heading and its body, or between the stacked rows of a list or a summary
- Vertical rules between inline labels or side-by-side menu entries in one row
- Labelled breaks with a short caption on the rule, such as "or continue with"

## When not to use

- A trail of links back up to the parent pages: use [Breadcrumb](/components/breadcrumb)
- Phase breaks in an agent log or a transcript: use [Marker](/components/marker)

## Notes

- A vertical `Separator` takes its height from `self-stretch`, so it shows only in a flex row or a grid unless you give it a height (`h-8`)
- It renders `role="separator"`; mark purely decorative rules `aria-hidden`

## Separator: a line between things

`Separator` draws a horizontal or vertical rule, built on Base UI's separator. It divides content visually and, unless hidden, semantically.

### What is Separator?

A one-pixel line in the border colour. Horizontal between blocks, vertical between inline items.

### Why use Separator?

Spacing alone sometimes is not enough to show where one group ends. A rule makes the break explicit without adding a container.

### Separator features

- **Horizontal or vertical.** `orientation`.
- **Labelled.** Put a caption on the rule with a small wrapper.

## Integrating with other components

Divide [Card](/components/card) sections, [Dropdown Menu](/components/dropdown-menu) groups (they have their own separators), toolbar groups and sign-in options ("or continue with").

## Frequently asked questions

### How do I put text on the line?

Wrap two separators and the text in a flex row, as the Centered Label example does.

### Is it accessible?

It is `role="separator"` with its orientation; decorative rules should be `aria-hidden` so they are not announced.
