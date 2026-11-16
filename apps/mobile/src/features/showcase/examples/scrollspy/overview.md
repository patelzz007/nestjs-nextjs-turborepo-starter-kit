## When to use

- A long page of sections: docs, a policy, settings
- Jumping to a section and seeing where you are

## When not to use

- Separate screens: use [Tabs](/showcase/tabs)
- A short page: no navigation needed

## Notes

- The link of the section in view is highlighted as the panel scrolls
- Tapping a link scrolls to its section
- The caller sizes the panel

## Scrollspy: links that follow the scroll

`Scrollspy` takes `sections` and draws their links beside or above a scrolling panel.

### Features

- **Navigation.** A column beside the panel, or a row above it.
- **Follows the scroll.** `onActiveChange` reports the section in view.

## Integrating with other components

Sections hold any content: text, [Card](/showcase/card)s, forms.

## Frequently asked questions

### How is the section in view chosen?

It is the last section whose top has reached the top of the panel.
