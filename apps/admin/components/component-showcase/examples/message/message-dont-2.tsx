import * as React from "react";
import { Bubble, BubbleContent } from "@workspace/ui/components/bubble";
import { Message, MessageContent, MessageFooter } from "@workspace/ui/components/message";

export function MessageDont2Example(): React.JSX.Element {
	return (
		<Message align="end" className="w-full max-w-sm">
			<MessageContent>
				<Bubble>
					<BubbleContent>Sent the contract over.</BubbleContent>
				</Bubble>
			</MessageContent>
			<MessageFooter className="text-base font-semibold text-foreground">09:42 · Read</MessageFooter>
		</Message>
	);
}
