// The emoji the showcase's picker examples share: emojibase-data's English
// files, turned into picker data once. An app does the same with the
// languages it ships (lib/emoji-picker's `emojiPickerDataFromEmojibase`).

import { emojiPickerDataFromEmojibase, type EmojiPickerData } from "@workspace/ui-native/lib/emoji-picker";
import ENGLISH_COMPACT from "emojibase-data/en/compact.json";
import ENGLISH_MESSAGES from "emojibase-data/en/messages.json";
import GITHUB_SHORTCODES from "emojibase-data/en/shortcodes/github.json";

export const ENGLISH_EMOJI: EmojiPickerData = emojiPickerDataFromEmojibase({
	locale: "en",
	compact: ENGLISH_COMPACT,
	messages: ENGLISH_MESSAGES,
	shortcodes: [GITHUB_SHORTCODES],
});
