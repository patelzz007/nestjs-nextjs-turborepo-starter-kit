## When to use

- Chat messages, assistant replies, quick replies

## When not to use

- Long documents: use RichTextView

## Notes

- `sent` sits at the trailing edge, `received` at the leading one
- `tone` gives the web's variants; `reactions` hang off the edge; `onPress` makes a quick reply

## Bubble

`Bubble` draws one message's text (or any content) on a rounded surface, coloured by side or tone.

### Features

- **Tones**: primary, secondary, muted, tinted, outline, ghost, destructive.
- **Reactions** with screen-reader names.
- **Quick replies** as buttons.

## Integrating with other components

Wrap bubbles in a Message for avatars, names and times; put attachments inside.

## Frequently asked questions

### Can people copy a bubble's text?

Yes: the text is selectable (unless the bubble is a button).
