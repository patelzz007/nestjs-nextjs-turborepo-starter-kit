## When to use

- Chat, support and team threads laid out turn by turn, with avatars, sender names and read receipts
- Assistant replies carrying a copy, regenerate and rating toolbar, or a pending then streaming state
- Shared images and documents carried in a turn beside its text

## When not to use

- A text surface on its own, with no avatar or metadata: use [Bubble](/components/bubble)
- A long thread that scrolls and stays pinned to the newest turn: wrap messages in [Message Scroller](/components/message-scroller)

## Notes

- On an `align="end"` row, only children of `MessageContent` that carry a `data-slot` move to the end
- `MessageHeader` and `MessageFooter` set no gap: add one when they hold several items

## Message: a full chat turn

`Message` lays out one turn of a conversation: `MessageAvatar`, `MessageHeader` (the sender, a time), `MessageContent` (bubbles, attachments, code) and `MessageFooter` (status, actions). `MessageGroup` joins consecutive turns from one sender.

### What is Message?

The row of a chat transcript, for people and for assistants — including an assistant's pending and streaming states.

### Why use Message?

Every chat needs the same structure: who said it, when, what, and what you can do with it. One component keeps support threads, team chats and AI transcripts consistent.

### Message features

- **Avatars, headers and footers.**
- **Either side.** `align` start or end.
- **Rich content.** [Bubble](/components/bubble)s, [Attachment](/components/attachment)s and [Code Block](/components/code-block)s.
- **Assistant turns.** Toolbars and streaming.

## Integrating with other components

Use [Avatar](/components/avatar)s, [Bubble](/components/bubble)s, [Attachment](/components/attachment)s and [Relative Time](/components/relative-time) inside; put the transcript in a [Message Scroller](/components/message-scroller).

## Frequently asked questions

### How do I show a streaming reply?

Render the growing text (or a [Code Block](/components/code-block) with `streaming`) in `MessageContent`, as the Streaming Reply example does.

### Is it accessible?

The header names the sender in text; actions in the footer are named buttons.
