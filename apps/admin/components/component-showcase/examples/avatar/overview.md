## When to use

- Profile photos with initials or an icon that stand in when the picture is missing or fails
- Presence dots, verified marks and number badges pinned to the corners of a person's photo
- Overlapping team stacks, social-proof rows and user chips inside buttons or account triggers

## When not to use

- A user from the app's own data, with renditions and initials worked out for you: use [User Avatar](/components/user-avatar)
- An organisation, store or team with no photo: use [Entity Avatar](/components/entity-avatar)

## Notes

- Derive the initials in `AvatarFallback` from the person's name, rather than typing them
- A square avatar needs the same radius on `AvatarImage` and `AvatarFallback`, since both default to round

## Avatar: a person's picture

`Avatar` shows a profile photo, built on Base UI's avatar: `AvatarImage` loads the picture and `AvatarFallback` shows initials or an icon until it loads, or if it fails. `AvatarBadge` pins a dot or a mark to a corner, and `AvatarGroup` overlaps several into a stack with an optional `AvatarGroupCount`.

### What is Avatar?

The round (or square) picture next to a name in comments, menus, tables and headers.

### Why use Avatar?

Faces and initials make people recognisable at a glance. A fallback that is always there keeps layouts stable when photos are slow or missing.

### Avatar features

- **Image with fallback.** Initials or an icon while loading or on error.
- **Sizes and shapes.** `size`, round or square.
- **Badges.** Presence dots, verified marks, counts.
- **Groups.** Overlapping stacks with a "+5" count.

## Integrating with other components

Put avatars in [Item](/components/item) rows, [Dropdown Menu](/components/dropdown-menu) triggers for the account, [Message](/components/message)s, and [Combobox](/components/combobox) chips; show the person's card with a [Hover Card](/components/hover-card).

## Frequently asked questions

### Avatar or User Avatar?

`Avatar` is the primitive; [User Avatar](/components/user-avatar) wraps it for the app's users, picking the right image rendition and the initials from the name.

### Is it accessible?

Give `AvatarImage` an `alt` (the person's name) unless the name is already beside it, in which case hide the avatar from assistive technology.
