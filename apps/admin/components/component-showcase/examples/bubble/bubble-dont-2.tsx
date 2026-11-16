import * as React from "react";
import { Bubble, BubbleContent } from "@workspace/ui/components/bubble";

export function BubbleDont2Example(): React.JSX.Element {
	return (
		<div className="flex w-full max-w-sm flex-col gap-2">
			<Bubble variant="muted" align="start">
				<BubbleContent>Your refund is on its way.</BubbleContent>
			</Bubble>
			<Bubble variant="destructive" align="end">
				<BubbleContent>Thanks! How long does it take?</BubbleContent>
			</Bubble>
		</div>
	);
}
