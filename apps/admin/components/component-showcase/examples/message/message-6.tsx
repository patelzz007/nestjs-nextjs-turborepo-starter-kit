import * as React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import { Bubble, BubbleContent } from "@workspace/ui/components/bubble";
import { Message, MessageAvatar, MessageContent, MessageGroup, MessageHeader } from "@workspace/ui/components/message";

/*
 * A run from one person gets one portrait, on the last row. The earlier rows
 * still render MessageAvatar, just empty: it keeps its minimum width and holds
 * the spine that the last row sits on. Dropping the slot knocks the run off it.
 */
export function Message6Example(): React.JSX.Element {
	return (
		<div className="mx-auto flex w-full max-w-sm flex-col gap-6">
			{/*
        The gap inside a run belongs to MessageGroup and the gap between runs
        to this column, so the two can differ per style with nothing hardcoded.
      */}
			<MessageGroup>
				<Message>
					<MessageAvatar />
					<MessageContent>
						{/*
              Only the first row of a run carries a name. The rest inherit it,
              which is the whole reason to group them.
            */}
						<MessageHeader>Alex Johnson</MessageHeader>
						<Bubble variant="muted">
							<BubbleContent>I pulled the eu-west traces for 14:00 to 14:10.</BubbleContent>
						</Bubble>
					</MessageContent>
				</Message>

				<Message>
					<MessageAvatar />
					<MessageContent>
						<Bubble variant="muted">
							<BubbleContent>Every slow request goes through the tax service.</BubbleContent>
						</Bubble>
					</MessageContent>
				</Message>

				<Message>
					<MessageAvatar>
						<Avatar>
							<AvatarImage src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=96&h=96&dpr=2&q=80" alt="Alex Johnson" />
							<AvatarFallback>AJ</AvatarFallback>
						</Avatar>
					</MessageAvatar>
					<MessageContent>
						<Bubble variant="muted">
							<BubbleContent>It is a retry loop, not the database. Two retries at 400ms each.</BubbleContent>
						</Bubble>
					</MessageContent>
				</Message>
			</MessageGroup>

			<Message align="end">
				<MessageAvatar>
					<Avatar>
						<AvatarImage src="https://images.unsplash.com/photo-1485893086445-ed75865251e0?w=96&h=96&dpr=2&q=80" alt="Emma Wilson" />
						<AvatarFallback>EW</AvatarFallback>
					</Avatar>
				</MessageAvatar>
				<MessageContent>
					<Bubble>
						<BubbleContent>That lines up with the 14:04 deploy. Rolling the tax client back.</BubbleContent>
					</Bubble>
				</MessageContent>
			</Message>
		</div>
	);
}
