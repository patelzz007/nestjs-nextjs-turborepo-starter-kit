import * as React from "react";
import { Bubble, BubbleContent } from "@workspace/ui/components/bubble";
import { Message, MessageContent } from "@workspace/ui/components/message";

export function MessageDont1Example(): React.JSX.Element {
	return (
		<div className="flex w-full max-w-sm flex-col gap-3">
			<Message>
				<MessageContent>
					<Bubble variant="muted">
						<BubbleContent>Staging is green.</BubbleContent>
					</Bubble>
				</MessageContent>
			</Message>
			<Message>
				<MessageContent>
					<Bubble variant="muted">
						<BubbleContent>Hold the release until billing lands.</BubbleContent>
					</Bubble>
				</MessageContent>
			</Message>
		</div>
	);
}
