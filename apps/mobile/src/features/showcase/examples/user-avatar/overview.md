## When to use

- A person's profile picture served in several sizes

## When not to use

- Organisations: see EntityAvatar (the same Avatar, rounded)

## Notes

- On a phone it is the kit's `Avatar`: `sources` picks the rendition sharp at its size on this screen
- Falls back to the initials when there is no photo or it fails to load

## UserAvatar

A person's photo (the rendition that fits) or their initials: the kit's `Avatar` with `sources`.

### Features

- **Renditions**: the smallest sharp one is downloaded.
- **Initials** fallback.

## Integrating with other components

Put the person's name beside it; use it in lists, headers and messages.

## Frequently asked questions

### Why pass several sizes?

A 32-point avatar should not download a 2,000-pixel photo: the rendition picked is the smallest that stays sharp.
