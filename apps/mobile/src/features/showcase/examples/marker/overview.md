## When to use

- Lines of a log, a transcript or a run summary: a glyph and a short text
- A labelled divider between phases of a run
- A ruled list of changed files

## When not to use

- Steps that open to their detail: use Trace
- A status that changes over time on its own: use StatusBadge

## Notes

- The glyph is decorative: the text alone must carry the line
- With `onPress` a line is a named link or button

## Marker

`Marker` is one line of status — a glyph and a short text — or a labelled divider between phases.

### Features

- **Variants** `default`, `separator`, `border`.
- **Parts** MarkerIcon (hidden from screen readers) and MarkerContent.
- **Pressable lines**: links, or a button.

## Integrating with other components

Put Badges, a Spinner (in MarkerIcon) or a count after the content; stack markers in a Card for a run summary.

## Frequently asked questions

### Marker or Trace?

Trace when a step opens to its detail; Marker for plain lines.
