import * as React from "react";
import { EmojiPicker, EmojiPickerContent, EmojiPickerTrigger } from "@workspace/ui/components/emoji-picker";
import { Label } from "@workspace/ui/components/label";

export function EmojiPickerDo1Example(): React.JSX.Element {
	const [icon, setIcon] = React.useState<string | null>("🚀");
	return (
		<div className="flex items-center gap-3">
			<Label>Project icon</Label>
			<EmojiPicker value={icon} onValueChange={setIcon} aria-label="Project icon">
				<EmojiPickerTrigger variant="outline" size="icon" />
				<EmojiPickerContent />
			</EmojiPicker>
		</div>
	);
}
