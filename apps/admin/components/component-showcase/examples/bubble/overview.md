## When to use

- Chat and support threads where each turn shows its sender by side and colour
- Assistant replies in a transcript, including long answers folded to a lead and formatted answers
- Turn extras such as emoji reactions and quick-reply choices people press

## When not to use

- A turn that needs an avatar, a sender name, a timestamp or actions: use [Message](/components/message)
- An empty conversation waiting for its first turn: use [Empty](/components/empty)

## Notes

- `align="end"` sets `align-self`, so each `Bubble` needs a flex-column parent
- A pressable bubble is `BubbleContent` itself, through `render`

## Bubble: a chat turn's surface

`Bubble` is the text surface of a chat turn: `BubbleContent` in one of several variants (the sender's, the other side's, the assistant's, muted, outline), aligned to the start or the end, grouped with `BubbleGroup`, with `BubbleReactions` underneath.

### What is Bubble?

The speech bubble of a conversation, without the avatar and metadata — those belong to [Message](/components/message), which composes bubbles.

### Why use Bubble?

Conversations read by side and colour. Shared bubble variants keep every chat in the app consistent, from support threads to AI answers.

### Bubble features

- **Variants.** For the sender, the other side, the assistant and more.
- **Alignment.** Start or end.
- **Groups.** Consecutive turns joined with tighter corners.
- **Reactions and quick replies.**

## Integrating with other components

Wrap bubbles in a [Message](/components/message) for avatars and timestamps, and in a [Message Scroller](/components/message-scroller) for a transcript. Render code in replies with [Code Block](/components/code-block).

## Frequently asked questions

### Bubble or Message?

`Bubble` for the text surface alone; [Message](/components/message) for a full turn with an avatar, a header and a footer.

### Is it accessible?

Bubbles are text; say the sender in text (a visually hidden name, or a message header) rather than by side and colour alone.
