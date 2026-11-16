## Installation

The emoji picker parts ship with the kit in `packages/ui/src/components/emoji-picker.tsx` and the files beside it. Its data comes from `emojibase`, already installed.

```showcase-example
c-emoji-picker-1
```

## Usage

```tsx
import {
	EmojiPicker,
	EmojiPickerCategories,
	EmojiPickerContent,
	EmojiPickerFooter,
	EmojiPickerHeader,
	EmojiPickerList,
	EmojiPickerPreview,
	EmojiPickerSearch,
	EmojiPickerSkinTone,
	EmojiPickerTrigger,
} from "@workspace/ui/components/emoji-picker";
```

```tsx
<EmojiPicker value={null} onEmojiSelect={({ value }) => insert(value)}>
	<EmojiPickerTrigger />
	<EmojiPickerContent>
		<EmojiPickerHeader>
			<EmojiPickerSearch />
		</EmojiPickerHeader>
		<EmojiPickerCategories />
		<EmojiPickerList />
		<EmojiPickerFooter>
			<EmojiPickerPreview />
			<EmojiPickerSkinTone />
		</EmojiPickerFooter>
	</EmojiPickerContent>
</EmojiPicker>
```

## Examples

### Chat composer

```showcase-example
c-emoji-picker-2
```

### Message reactions

```showcase-example
c-emoji-picker-3
```

### Page icon

```showcase-example
c-emoji-picker-4
```

### Custom team emoji

```showcase-example
c-emoji-picker-5
```

### Shortcode suggestions

```showcase-example
c-emoji-picker-6
```

## API Reference

```showcase-api

```

## Keyboard

| Key             | Action                                    |
| :-------------- | :---------------------------------------- |
| Typing          | Searches, with focus in the search field. |
| `↑` `↓` `←` `→` | Moves through the grid.                   |
| `Enter`         | Picks the highlighted emoji.              |
| `Esc`           | Closes the popover.                       |

## Accessibility

- Focus stays in the search field while the arrow keys move the highlight through the grid, which is exposed as the active option.
- Each emoji is named; the category tabs and the skin-tone chooser are keyboard-operable.
