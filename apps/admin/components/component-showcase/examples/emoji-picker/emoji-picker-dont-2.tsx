import * as React from "react";
import { EmojiPicker, EmojiPickerContent, EmojiPickerTrigger } from "@workspace/ui/components/emoji-picker";

export function EmojiPickerDont2Example(): React.JSX.Element {
	const [icon, setIcon] = React.useState<string | null>("🚀");
	return (
		<EmojiPicker value={icon} onValueChange={setIcon}>
			<EmojiPickerTrigger variant="outline" size="icon" />
			<EmojiPickerContent />
		</EmojiPicker>
	);
}
