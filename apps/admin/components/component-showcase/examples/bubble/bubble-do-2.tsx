import * as React from "react";
import { Bubble, BubbleContent } from "@workspace/ui/components/bubble";

export function BubbleDo2Example(): React.JSX.Element {
	return (
		<div className="flex w-full max-w-sm flex-col gap-2">
			<Bubble variant="default" align="end">
				<BubbleContent>Sending the contract now.</BubbleContent>
			</Bubble>
			<Bubble variant="destructive" align="end">
				<BubbleContent>Not sent: the file is over 25 MB. Tap to retry.</BubbleContent>
			</Bubble>
		</div>
	);
}
