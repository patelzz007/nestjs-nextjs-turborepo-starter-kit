## When to use

- A list, a search or a screen with nothing in it yet
- The first run of a feature, offering the action that fills it
- A cleared inbox or task list, to say there is nothing left to do

## When not to use

- A failed load: use ErrorState, with a retry
- A load in progress: use LoadingState, a Skeleton or a Spinner
- A tiny inline gap (one empty cell): leave it blank or write a dash

## Notes

- Pass the way forward as children (a Button, a TextLink)
- An `illustration` replaces the icon tile; it is decorative and hidden from screen readers

## EmptyState

`EmptyState` says what is missing and what to do about it: an icon tile or a drawing, a title, a message, and the way forward.

### Features

- **Surfaces** `muted` (a filled panel), `outline` (a bordered card), `dashed` (a drop area), `plain` (none).
- **Alignment** `start` or `center`.
- **Icon** in a tile, in any tile tone (`iconTone`), or an **illustration** of your own.
- **LoadingState** and **ErrorState** cover the two other states a list can be in.

## Integrating with other components

Put it inside a Card's content, a list's empty slot, or a whole screen; drawings can use react-native-svg with the theme's colours.

## Frequently asked questions

### Why is the drawing hidden from screen readers?

It decorates; the title and the message already say what is missing.

### How do I draw an illustration in the theme's colours?

react-native-svg takes colour values, not classes: read them with `useCSSVariable` (see the examples' `illustration.tsx`).
