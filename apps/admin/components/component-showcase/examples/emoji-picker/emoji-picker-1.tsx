"use client";

import * as React from "react";
import { useState } from "react";
import { EmojiPicker, EmojiPickerPanel } from "@workspace/ui/components/emoji-picker";

import { Card } from "@workspace/ui/components/card";

export function EmojiPicker1Example(): React.JSX.Element {
	// Controlled, as an inline picker usually feeds a form. Nothing echoes it:
	// the footer preview falls back to it and the panel announces each pick.
	const [value, setValue] = useState<string | null>(null);

	return (
		// Card has no flush size, so `py-0` keeps its padding off the panel's own
		// insets; `w-fit` hugs the panel when the parent is not a flex row.
		<Card className="w-fit py-0">
			<EmojiPicker value={value} onValueChange={setValue}>
				<EmojiPickerPanel />
			</EmojiPicker>
		</Card>
	);
}
