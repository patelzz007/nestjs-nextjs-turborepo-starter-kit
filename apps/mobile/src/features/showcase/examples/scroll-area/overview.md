## When to use

- A long list in a short box: tags, releases
- A row that pans sideways: photos, chips
- A wide table that pans both ways

## When not to use

- A whole screen: the screen itself scrolls
- Content that fits: no box needed

## Notes

- Edges can fade while content is hidden past them
- `gutter` keeps the scrollbar clear of the content once it overflows
- The caller sizes the box (`h-72`, `w-48`)

## ScrollArea: a bounded scroll container

`ScrollArea` is a framed `ScrollView` that pans vertically, horizontally or both.

### Features

- **Orientation.** Vertical, horizontal, or both.
- **Fades.** Only on edges that hide content, in the surface's colour.
- **Gutter.** Room for the scrollbar once it overflows.
- **Frame.** Plain or outlined.

## Integrating with other components

Fill it with [Separator](/showcase/separator)-divided rows, [Card](/showcase/card)s or a table.

## Frequently asked questions

### Why do the fades come and go?

They show only on the sides that hide content, so a fade always means "more this way".
