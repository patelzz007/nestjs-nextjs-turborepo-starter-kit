## When to use

- A request error with a way forward
- A notice, a warning or a success on a screen
- An announcement with actions

## When not to use

- A short message that goes away by itself: use [Toast](/showcase/toast)
- A decision before going on: use [AlertDialog](/showcase/alert-dialog)

## Notes

- Errors are announced as alerts (assertively); other tones politely
- Actions sit under the message, wrapping on a narrow screen
- `flush` fills a framed panel edge to edge

## Alert: a message block

`Alert` takes a `tone`, a `title` and `message`, an optional glyph or leading avatar, richer content, actions and a close button.

### Features

- **Tones.** Neutral, info, success, warning, error, invert.
- **Glyph or avatar.** With a colour override.
- **Rich content.** A checklist, a quote.
- **Actions and close.** Buttons under the message; a corner close button.
- **Flush.** No radius or border, for framed panels.

## Integrating with other components

Put [Button](/showcase/button)s as children and an [Avatar](/showcase/avatar) as `leading`.

## Frequently asked questions

### Can it hold a list?

Yes: pass it as `content`, under the message.
