## When to use

- A person from the app's data — an admin, a customer, a merchant user — anywhere their face or initials should appear
- Avatars that should load the right-sized rendition of an uploaded profile picture

## When not to use

- Organisations, stores and teams: use [Entity Avatar](/components/entity-avatar)
- Custom avatar markup with badges or groups: use [Avatar](/components/avatar)

## Notes

- `image` is the stored profile picture (with its renditions) or `null`; the initials come from `name`
- `drawnSize` is the avatar's size in CSS pixels, used to pick the rendition from the `srcset`

## User Avatar: the app's people, consistently

`UserAvatar` is the kit's avatar for a person: their profile picture, served from its renditions with `srcset`, or their initials while it loads, if it fails, or when they have none.

### What is User Avatar?

A ready-made `Avatar` for people, so every screen shows a person the same way — the same initials rule, the same rendition choice, the same fallback.

### Why use User Avatar?

Hand-built avatars drift: one screen uses the first letter, another two; one loads the original photo, another a thumbnail. `UserAvatar` settles both once.

### User Avatar features

- **Renditions.** The image's sizes as a `srcset`, chosen by `drawnSize`.
- **Initials.** From the name, when there is no picture or it fails.
- **Accessible name.** `alt` defaults to the person's name.

## Integrating with other components

Use it in [Item](/components/item) rows, [Message](/components/message)s, [Data Table](/components/data-table) cells and account menus. For a stack of people, put several in an [Avatar](/components/avatar) group.

## Frequently asked questions

### Where does the image come from?

From the person's stored profile picture: pass it as `image` (or `null`), and the component builds the `srcset` from its renditions.

### Is it accessible?

Its `alt` is the person's name by default; hide it when the name is shown next to it.
