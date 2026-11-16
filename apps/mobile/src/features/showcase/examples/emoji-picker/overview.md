## When to use

- Reactions on a message, a post or a comment
- An emoji in a composer, a status or a name
- An icon for a page, a project or a channel

## When not to use

- A fixed handful of reactions: use a row of [Button](/showcase/button) or a [ToggleGroup](/showcase/toggle-group)
- Rating something: use [Rating](/showcase/rating)
- Choosing an icon from the app's own set: use a [Select](/showcase/select) of glyphs

## Notes

- The picker is data-agnostic: import the emojibase-data files your app needs and build the data with `emojiPickerDataFromEmojibase`, so the bundle carries only those languages
- Values are native emoji with the skin tone applied, or `:shortcode:` for a custom emoji
- The grid is virtualized: thousands of emoji draw only the rows on screen

## EmojiPicker: search, tones, sections

`EmojiPickerPanel` is the picker: a search box, a skin tone choice, category tabs and a grid. `EmojiPicker` is a button that opens it in a bottom sheet and shows the picked emoji.

### What is it?

A searchable, sectioned grid of emoji that reports each pick as a value, the emoji's data and the skin tone.

### Why use it?

Searching names, keywords and shortcodes (in the data's language) finds an emoji in a few letters; tones, frequently used emoji and the app's own emoji are built in.

### Features

- **Search.** Names, keywords and shortcodes, ranked; accents and colons ignored.
- **Skin tones.** Six tones, the caller's or the picker's own.
- **Sections.** Frequently used (`frequent`), the app's own image emoji (`customEmoji`, `customCategories`), then the Unicode categories, less any in `excludeCategories`.
- **A header.** `header` sits above the search: quick reactions, a title.
- **Any language.** Data from emojibase-data in that language, and `labels` for the picker's own words.
- **Text helpers.** `openShortcodeOf`, `completeShortcode`, `replaceShortcodes` and `searchEmojis` for shortcode suggestions in a text box.

## Integrating with other components

Put the button beside an [Input](/showcase/input) in a composer, under a [Bubble](/showcase/bubble) for reactions, or above a [Textarea](/showcase/textarea) for posts.

## Frequently asked questions

### Where does the emoji data come from?

From the `emojibase-data` package: its `compact.json`, `messages.json` and a shortcode set, passed to `emojiPickerDataFromEmojibase`. Build it once, at module level, not on every render.

### How do I store a custom emoji?

As its colon code (`:shipit:`), the value the picker reports; draw it back from your own list of images.

### How do I remember frequently used emoji?

Keep the picked values in your app's state or storage, most used first, and pass them as `frequent`.
