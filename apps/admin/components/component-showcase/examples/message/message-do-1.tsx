import * as React from "react";
import { Bubble, BubbleContent } from "@workspace/ui/components/bubble";
import { Message, MessageContent, MessageHeader } from "@workspace/ui/components/message";

export function MessageDo1Example(): React.JSX.Element {
	return (
		<div className="flex w-full max-w-sm flex-col gap-3">
			<Message>
				<MessageHeader>Ada</MessageHeader>
				<MessageContent>
					<Bubble variant="muted">
						<BubbleContent>Staging is green.</BubbleContent>
					</Bubble>
				</MessageContent>
			</Message>
			<Message>
				<MessageHeader>Alan</MessageHeader>
				<MessageContent>
					<Bubble variant="muted">
						<BubbleContent>Hold the release until billing lands.</BubbleContent>
					</Bubble>
				</MessageContent>
			</Message>
		</div>
	);
}
