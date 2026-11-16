## When to use

- Holding a screen's layout while its content loads: profiles, cards, lists, tables, forms
- A first load whose shape you know, so nothing moves when the content arrives

## When not to use

- A wait whose shape you do not know: use Spinner
- Work with a known amount left: use Progress
- Content that loads in well under a second: show nothing (the group waits a beat before it fades in anyway)

## Notes

- `SkeletonGroup` owns the sweep and the reveal, and names what is loading for screen readers
- Shape each `Skeleton` with token classes (`size-12 rounded-full`); `SkeletonText` matches a text role's line height

## Skeleton

Skeletons draw the shape of content that is still loading, where it will appear. One highlight band sweeps across every bone at once, then rests; it stays still under Reduce Motion.

### Features

- **Skeleton**: one block, sized and shaped by `className`.
- **SkeletonText**: one line of text, exactly a text role's line height.
- **SkeletonGroup**: the sweep, a short delay before it fades in, and a busy progress bar for screen readers.

## Integrating with other components

Lay bones out inside a Card, a list or a table exactly as the loaded content will sit.

## Frequently asked questions

### Why does nothing show for a moment?

The group waits a beat before it fades in, so a fast load never flashes grey.

### Skeleton or Spinner?

A Skeleton when you know the shape of what is coming; a Spinner when you do not.
