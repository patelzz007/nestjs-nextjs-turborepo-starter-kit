## When to use

- Placeholders for avatars and user info, text paragraphs, forms and media cards while data loads
- Loading states for tables, dashboard stats, lists with row actions, profile pages and chat threads

## When not to use

- A wait whose result has no known shape, such as a file being processed: use [Spinner](/components/spinner)
- A data table: [Data Table](/components/data-table) draws its own skeleton rows

## Notes

- `Skeleton` has no size of its own: size each one to the content it stands in for
- A skeleton is silent; announce the load from the region (the kit's `SkeletonRegion` does this with a status label)
- `variant="text"` matches a line of text and `variant="circular"` an avatar

## Skeleton: the shape of what is coming

`Skeleton` is a muted, softly pulsing block that stands in for content while it loads. Sized to match the real layout, it keeps the page from jumping when the data arrives.

### What is Skeleton?

A plain placeholder: a rectangle, a line of text or a circle. Compose several into the shape of a card, a row or a page.

### Why use Skeleton?

A layout that appears in its final shape feels faster than a spinner followed by a jump. Skeletons also show people what kind of content to expect.

### Skeleton features

- **Variants.** Blocks, text lines and circles.
- **Any shape.** Sized and rounded with classes.
- **Reduced motion.** The shimmer stays still for people who ask for less motion.

## Integrating with other components

The app's route `loading.tsx` files draw page skeletons inside a `SkeletonRegion`, which announces the load once. Mirror the real component — a [Card](/components/card), an [Avatar](/components/avatar) and lines — so the swap is seamless.

## Frequently asked questions

### Skeleton or Spinner?

A skeleton when the layout is known; a [Spinner](/components/spinner) for unknown shapes and short inline waits.

### Is it accessible?

Skeletons are decorative and silent; mark the loading region `aria-busy` or wrap it in `SkeletonRegion`, which announces "Loading…" once.
