import { EmojiPickerPanel, type EmojiPickerLabels } from "@workspace/ui-native/components/emoji-picker";
import { ToggleGroup, type ToggleGroupOption } from "@workspace/ui-native/components/toggle-group";
import { emojiPickerDataFromEmojibase, type EmojiPickerData, type EmojiPickerSelection } from "@workspace/ui-native/lib/emoji-picker";
import GERMAN_COMPACT from "emojibase-data/de/compact.json";
import GERMAN_MESSAGES from "emojibase-data/de/messages.json";
import GERMAN_SHORTCODES from "emojibase-data/de/shortcodes/cldr.json";
import * as React from "react";
import { View } from "react-native";

import { ENGLISH_EMOJI } from "./emoji-data";

type Language = "en" | "de";

const LANGUAGES: readonly ToggleGroupOption<Language>[] = [
	{ value: "en", label: "English" },
	{ value: "de", label: "Deutsch" },
];

const GERMAN_EMOJI: EmojiPickerData = emojiPickerDataFromEmojibase({ locale: "de", compact: GERMAN_COMPACT, messages: GERMAN_MESSAGES, shortcodes: [GERMAN_SHORTCODES] });

const GERMAN_LABELS: Partial<EmojiPickerLabels> = {
	searchPlaceholder: "Emoji suchen",
	search: "Emoji suchen",
	clearSearch: "Suche leeren",
	noResults: "Kein Emoji gefunden.",
	searchResults: "Suchergebnisse",
	frequentlyUsed: "Häufig verwendet",
	skinTone: "Hautfarbe",
	skinTones: ["Standard", "Hell", "Mittelhell", "Mittel", "Mitteldunkel", "Dunkel"],
	loading: "Emoji werden geladen",
};

const NO_LABELS: Partial<EmojiPickerLabels> = {};

export function EmojiPicker8Example(): React.JSX.Element {
	const [language, setLanguage] = React.useState<Language | null>("de");
	const [value, setValue] = React.useState<string | null>(null);
	const pick = React.useCallback((selection: EmojiPickerSelection): void => {
		setValue(selection.value);
	}, []);
	const german = language === "de";
	return (
		<View className="gap-3">
			<ToggleGroup type="single" label="Language" options={LANGUAGES} value={language} onChange={setLanguage} size="sm" spacing="attached" variant="outline" />
			{/* Keyed on the language, so switching clears the search. */}
			<EmojiPickerPanel
				key={language ?? "en"}
				data={german ? GERMAN_EMOJI : ENGLISH_EMOJI}
				labels={german ? GERMAN_LABELS : NO_LABELS}
				value={value}
				onSelect={pick}
				variant="card"
			/>
		</View>
	);
}
