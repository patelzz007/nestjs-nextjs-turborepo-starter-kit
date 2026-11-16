## When to use

- Showing where a screen sits in a deep hierarchy: docs, files, settings
- Letting people jump back up more than one level

## When not to use

- A flat app with tabs: the tab bar already says where you are
- Steps of a flow: use [Stepper](/showcase/stepper)

## Notes

- A long trail scrolls sideways, or folds its middle into an ellipsis with `maxItems`
- The last item is the current page: not a link, and read as "current page"
- Links are short text: their touch area reaches 44 pt

## Breadcrumb: the path to this screen

`Breadcrumb` takes `items` (the last is the current page) and draws them as links split by a separator.

### What is it?

A data-driven trail of links.

### Why use it?

It shows the hierarchy and gives a quick way back up.

### Features

- **Separators.** Chevron, double chevron, slash, bar.
- **Folding.** `maxItems`, with an optional menu of the hidden levels.
- **Rich levels.** A glyph, an avatar or tile, a count, a second line; glyph-only levels.
- **Looks.** Plain, card, pill, buttons.

## Integrating with other components

Levels take an [Avatar](/showcase/avatar) or an [IconTile](/showcase/icon-tile); put a home [IconButton](/showcase/button) before it.

## Frequently asked questions

### How do I wire navigation?

Give each level an `onPress` that calls your router.
