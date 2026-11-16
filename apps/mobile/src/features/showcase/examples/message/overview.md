## When to use

- A conversation's rows: avatar, name, bubbles, time, status

## When not to use

- A one-off notice: use Alert

## Notes

- Lays out an avatar slot, a header (or the author's name), the bubbles, the time and a footer
- `sent` mirrors the row to the trailing edge

## Message

`Message` is one message in a conversation: an avatar slot, a header, its bubbles, a timestamp and a footer.

### Features

- **Header and footer** slots for names, receipts and actions.
- **Avatar slot** that can stay empty to keep a run aligned.

## Integrating with other components

Fill it with Bubbles and Attachments; put a list of them in a MessageScroller.

## Frequently asked questions

### How do I group a sender's run?

Show the name on the first row and the avatar on the last, with an empty avatar-sized View between (see Consecutive Messages).
