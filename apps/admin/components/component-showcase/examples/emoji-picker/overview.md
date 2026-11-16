## When to use

- Message composers, replies and notes that insert emoji at the caret of a text field
- Reactions on posts and messages, added from a popover beside the reaction pills
- A single stored emoji such as a page icon or a profile status, kept inline or behind a trigger

## When not to use

- Rendering a conversation as bubbles with avatars, names and times: use [Message](/components/message)
- A colour chosen from swatches, a spectrum or a typed hex value: use [Color Picker](/components/color-picker)

## Notes

- Left unset, `value` keeps each pick as the picker's value and `EmojiPickerTrigger` draws it in place of the smiley; insert-only pickers pass `value={null}`
- By default every picker on the site shares recent emoji and skin tone through `localStorage`; scope them with `recentStorageKey` and `skinToneStorageKey`

## Emoji Picker: search, categories, recents and skin tones

`EmojiPicker` is a searchable emoji grid with category tabs, frequently used emoji, skin tones, shortcodes and custom emoji. The grid is virtualised, so only the rows in view render — a page full of reaction pickers stays fast.

### What is Emoji Picker?

A set of parts around one picker state: a trigger and a popover (or an inline panel), a search field, category tabs, the grid, a preview and a skin-tone chooser. Helpers search, find and format emoji for custom surfaces such as a `:shortcode:` autocomplete.

### Why use Emoji Picker?

Reactions and expressive messages are expected in chat and comments. A picker that searches by name and shortcode, remembers recents and respects skin tones makes emoji quick to find without leaving the keyboard.

### Emoji Picker features

- **Search.** Names, keywords and shortcodes, ranked.
- **Categories and recents.** Tabs that follow the scroll; frequently used first.
- **Skin tones.** Remembered per site, or per picker with a storage key.
- **Custom emoji.** Team emoji as images with `:shortcode:` values.
- **Virtual grid.** Only visible rows render.
- **Localised.** Labels from the `emojiPicker` messages; emoji names in the data's locale.

## Integrating with other components

Insert picks into a [Textarea](/components/textarea) or an [Input Group](/components/input-group) composer at the caret, show reactions as a row of [Toggle](/components/toggle)s with counts, and use `EmojiPickerValue` to draw a stored emoji in a [Button](/components/button) or a page header.

## Frequently asked questions

### How do I insert an emoji into a text field?

Handle `onEmojiSelect`, insert `value` at the field's selection, and pass `value={null}` so the picker does not keep it.

### Can I add our own emoji?

Yes: custom emoji are images with a `:shortcode:` value, searchable and shown in their own category.

### Can I restrict the set?

Yes: filter the emoji data (the Workplace-Safe Set example removes some categories and emoji).

### Is it accessible?

Focus stays in the search field while the arrow keys move through the grid; each emoji is announced by name, and the category tabs are keyboard-operable.
