## When to use

- Several related panels under one title: a settings group, service statuses, a run's steps
- A summary block with a title bar and a footer line

## When not to use

- A single fact or line: put it in a Card or plain text
- A list of tappable rows: use ListGroup

## Notes

- Panels nest one radius step inside the tray's corner, so the arcs stay parallel
- `stacked` joins adjacent panels with shared borders; `dense` sets them flush with the tray

## Frame

`Frame` is a muted tray that holds one or more card-like panels, with an optional title bar and footer.

### Features

- **Variants** `default`, `inverse`, `ghost`.
- **Spacing** `xs`–`lg` for the panels and bars.
- **Radius** `sm`–`2xl`.
- **Stacked** and **dense** layouts; a panel can `fit` its content.

## Integrating with other components

Put text, StatTiles, a Collapsible or list rows inside its panels.

## Frequently asked questions

### Frame or Card?

A Card is one surface; a Frame is a tray of several panels that belong together.
