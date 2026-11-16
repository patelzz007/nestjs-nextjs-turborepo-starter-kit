## When to use

- Pending states inside buttons, badges and search fields while a request runs
- Loading views for a card or an empty panel, including a cover over content being refreshed
- Inline notes such as checking, syncing or reconnecting, led by a small spinner

## When not to use

- Content of a known layout, held as placeholder shapes until it arrives: use Skeleton
- A wait where the share of work done is known, such as an upload: use Progress
- A busy button: pass `loading` to the Button, which draws its own spinner

## Notes

- `Spinner` is announced busy, named "Loading" by default; name it for what it waits for
- Hold the controls a pending request affects from your own request state, not just with the spinner

## Spinner

`Spinner` is the platform's activity indicator for work of unknown length, in the theme's colours. `LoadingDots` is a row of three bouncing dots for a softer wait (someone typing).

### Features

- **Sizes** `sm` (inline, inside a control) and `lg` (alone in an empty area).
- **Colours** `default`, `muted`, `primary`, or one of yours (`colorClassName`).
- **States**: dimmed when disabled, destructive when invalid.
- **LoadingDots**: three dots on staggered bounces; still under Reduce Motion.

## Integrating with other components

Lead a Badge or a Button with it (`leading`), put it in an InputGroup's `leading`, or in an EmptyState's `illustration`.

## Frequently asked questions

### Spinner or Skeleton?

A Skeleton when you know the shape of what is coming; a Spinner when you do not.

### Spinner or Progress?

Progress when you know how much is done; a Spinner when you do not.
