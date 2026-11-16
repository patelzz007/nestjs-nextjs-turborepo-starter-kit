## When to use

- People and organisations in lists, headers, messages and menus

## When not to use

- Decorative images: use Image or CoverImage

## Notes

- One component for people (`circle`) and organisations (`rounded`)
- Badges, rings, soft or filled colours, a loading veil, and `AvatarGroup` for stacks

## Avatar

`Avatar` shows a person's picture or initials (or an organisation's logo or monogram), with badges, rings and colours; `AvatarGroup` stacks several.

### Features

- **Sizes** xs to xl and **shapes**.
- **Badges**: dots, icons, counts, at any corner, each named.
- **Rings** and **soft or filled** colours.
- **Groups** with a count or plus chip, stacked or spread.
- **Loading** veil.

## Integrating with other components

Put avatars in Buttons (`leading`), DropdownMenus, Messages and lists; group collaborators with AvatarGroup.

## Frequently asked questions

### How do screen readers hear a badge?

Each badge is named by its `label` ("Online", "3 unread"); a group is one image named by its `label`.

### Is there a greyscale filter?

Not on a phone: React Native images have no filters. Show inactive people muted instead.
