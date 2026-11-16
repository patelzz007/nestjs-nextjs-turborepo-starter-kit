import * as React from "react";
import { EmojiPicker, EmojiPickerPanel } from "@workspace/ui/components/emoji-picker";
import { Label } from "@workspace/ui/components/label";

export function EmojiPickerDont1Example(): React.JSX.Element {
	const [icon, setIcon] = React.useState<string | null>("🚀");
	return (
		<div className="flex flex-col gap-2">
			<Label>Project icon</Label>
			<EmojiPicker value={icon} onValueChange={setIcon}>
				<EmojiPickerPanel />
			</EmojiPicker>
		</div>
	);
}
