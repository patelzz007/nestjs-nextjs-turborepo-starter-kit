## When to use

- One topic on a screen: a setting group, a summary, a feature
- A tile in a list or a grid of similar items
- A form on its own surface (sign in)

## When not to use

- Around every row of a list: use a list group
- Inside another card: one surface per thought

## Notes

- Compose `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`, or use the `title`/`description` shorthand
- The parts never pad themselves: the card spaces them; rule them off with border classes

## Card

`Card` groups related content on one surface: a header, a body and a footer.

### Features

- **Sizes** `md` (a screen's section) and `sm` (a dense tile).
- **Parts** as on the web, in any order.
- **Fields inside** take the card's fill.

## Integrating with other components

Put Buttons in the footer, a DropdownMenu in the header, a photo (expo-image) at the top, or StatTiles in the body.

## Frequently asked questions

### Why not a card inside a card?

Two borders around one thought add weight without meaning; use a Separator or spacing inside the one card.
