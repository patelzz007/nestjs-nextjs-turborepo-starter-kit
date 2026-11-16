## When to use

- A history: an order's stages, a pull request's events, deploys
- A roadmap or milestones
- An activity feed with avatars

## When not to use

- Steps still to do in order: use [Stepper](/showcase/stepper)
- A plain list: use [ListGroup](/showcase/item)

## Notes

- Each entry has a node (a dot, an icon disc, an avatar) and its content; a line joins the nodes
- Horizontal timelines suit 3 or 4 phases on a phone
- `Timeline` draws a ready-made list of dated rows; `TimelineRailItem` is the building block

## TimelineRailItem: events on a line

`TimelineRailItem` takes a `node` and its content; `TimelineRailIcon` is an icon disc in a tone.

### Features

- **Nodes.** Dots, icon discs in tones, avatars.
- **Orientation.** Down the screen, or phases side by side.
- **Labels above.** A date over a horizontal phase.
- **Rich entries.** Badges, collapsible cards, mono details.

## Integrating with other components

Entries hold [Badge](/showcase/badge)s, [Collapsible](/showcase/collapsible) cards or [Avatar](/showcase/avatar)s as nodes.

## Frequently asked questions

### How do I show progress through stages?

Give reached stages a success icon disc and later ones a neutral ring, as in the order status example.
