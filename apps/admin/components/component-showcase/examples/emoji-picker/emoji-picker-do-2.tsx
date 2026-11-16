import * as React from "react";
import { EmojiPicker, EmojiPickerContent, EmojiPickerTrigger } from "@workspace/ui/components/emoji-picker";

export function EmojiPickerDo2Example(): React.JSX.Element {
	const [icon, setIcon] = React.useState<string | null>("🚀");
	return (
		<EmojiPicker value={icon} onValueChange={setIcon} aria-label="Project icon">
			<EmojiPickerTrigger variant="outline" size="icon" />
			<EmojiPickerContent />
		</EmojiPicker>
	);
}
