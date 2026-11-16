## Installation

`EmojiPicker` and `EmojiPickerPanel` ship with the kit in `packages/ui-native/src/components/emoji-picker.tsx`. The data comes from `emojibase-data`:

```bash
pnpm --filter mobile add emojibase-data
```

```showcase-example
c-emoji-picker-1
```

## Usage

```tsx
import { EmojiPicker } from "@workspace/ui-native/components/emoji-picker";
import { emojiPickerDataFromEmojibase } from "@workspace/ui-native/lib/emoji-picker";
import COMPACT from "emojibase-data/en/compact.json";
import MESSAGES from "emojibase-data/en/messages.json";
import GITHUB from "emojibase-data/en/shortcodes/github.json";

const EMOJI = emojiPickerDataFromEmojibase({ locale: "en", compact: COMPACT, messages: MESSAGES, shortcodes: [GITHUB] });
```

```tsx
<EmojiPicker label="Reaction" data={EMOJI} value={value} onSelect={(selection) => setValue(selection.value)} />
```

## Reactions

```showcase-example
c-emoji-picker-3
```

## In a composer

```showcase-example
c-emoji-picker-2
```

```showcase-example
c-emoji-picker-6
```

## Custom emoji

```showcase-example
c-emoji-picker-5
```

## A narrower set

```showcase-example
c-emoji-picker-7
```

## Another language

```showcase-example
c-emoji-picker-8
```

## API Reference

```showcase-api

```

## Accessibility

- The button is named by its label and the picked emoji's name ("Page icon: rocket"), and says it opens the picker.
- Each emoji is a button named by its name in the data's language; the picked one is marked selected.
- Category tabs are tabs named by their category; section titles are headers.
- The skin tone button says which tone is set and whether its choices are open; each tone is a radio.
- Custom emoji images are named by their label.
