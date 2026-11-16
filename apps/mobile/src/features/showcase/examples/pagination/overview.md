## When to use

- Moving through a long list or table page by page
- Showing where you are and how far there is to go

## When not to use

- A feed people scroll through: load more as they reach the end
- Steps of a flow: use [Stepper](/showcase/stepper)

## Notes

- The phone's default is compact: Previous and Next around "Page 2 of 10"
- `pages="numbers"` shows page buttons, shortened with ellipses around the current page
- The buttons at either end are disabled, never clamped

## Pagination: page through a list

`Pagination` is a controlled row: `page` and `pageCount` in, `onChange(page)` out.

### What is it?

Arrows, an optional page count or page buttons, and optional first and last jumps.

### Why use it?

It keeps long lists fast and tells people where they are.

### Features

- **Middles.** Page info, numbered pages, or nothing.
- **Arrows.** Words, chevrons, or none; first and last jumps.
- **Pages.** Square or round, outlined or filled current, or one joined strip.
- **Shortening.** `siblingCount`, `boundaryCount`, `showLastPage`.

## Integrating with other components

Pair it with a [NativeSelect](/showcase/native-select) for rows per page or a page jump, or an [Input](/showcase/input) for go to page.

## Frequently asked questions

### Why is the default not numbered?

A phone has little room: page numbers crowd the row and are small targets.
