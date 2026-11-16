import { EmojiPicker } from "@workspace/ui-native/components/emoji-picker";
import type { EmojiPickerSelection } from "@workspace/ui-native/lib/emoji-picker";
import * as React from "react";

import { ENGLISH_EMOJI } from "./emoji-data";

export function EmojiPickerDont2Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string | null>("🚀");
	const pick = React.useCallback((selection: EmojiPickerSelection): void => {
		setValue(selection.value);
	}, []);
	return <EmojiPicker label="" data={ENGLISH_EMOJI} value={value} onSelect={pick} />;
}
