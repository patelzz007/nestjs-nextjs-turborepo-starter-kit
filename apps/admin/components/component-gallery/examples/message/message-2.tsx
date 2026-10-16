import * as React from "react";
import { Avatar, AvatarBadge, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import { Bubble, BubbleContent } from "@workspace/ui/components/bubble";
import { Message, MessageAvatar, MessageContent } from "@workspace/ui/components/message";

/*
 * Hoisted because each person speaks twice. Repeating a 90-character URL per
 * turn is how a thread ends up rendering two crops of one face.
 */
const MICHAEL_AVATAR = "https://images.unsplash.com/photo-1584308972272-9e4e7685e80f?w=96&h=96&dpr=2&q=80";
const SARAH_AVATAR = "https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=96&h=96&dpr=2&q=80";

/*
 * MessageAvatar is self-end, so the third message runs long on purpose: a
 * wrapped turn is the only state in which the bottom anchoring is visible.
 */
export function Message2Example(): React.JSX.Element {
	return (
		<div className="mx-auto flex w-full max-w-sm flex-col gap-6">
			<Message>
				{/*
          MessageAvatar is a circular clip the size of the portrait, so a badge
          in its square corner loses half of itself. Badged rows opt out of it.
        */}
				<MessageAvatar className="overflow-visible">
					<Avatar>
						<AvatarImage src={MICHAEL_AVATAR} alt="Michael Rodriguez" />
						<AvatarFallback>MR</AvatarFallback>
						{/*
              Presence would be colour-only without the label, so the dot keeps
              its own sr-only text.
            */}
						<AvatarBadge className="bg-tone-green">
							<span className="sr-only">Online</span>
						</AvatarBadge>
					</Avatar>
				</MessageAvatar>
				<MessageContent>
					<Bubble variant="muted">
						<BubbleContent>eu-west checkout is timing out. It started around 14:05.</BubbleContent>
					</Bubble>
				</MessageContent>
			</Message>

			<Message align="end">
				<MessageAvatar>
					<Avatar>
						<AvatarImage src={SARAH_AVATAR} alt="Sarah Chen" />
						<AvatarFallback>SC</AvatarFallback>
					</Avatar>
				</MessageAvatar>
				<MessageContent>
					<Bubble>
						<BubbleContent>Looking now. Is it every request or one route?</BubbleContent>
					</Bubble>
				</MessageContent>
			</Message>

			<Message>
				<MessageAvatar className="overflow-visible">
					<Avatar>
						<AvatarImage src={MICHAEL_AVATAR} alt="Michael Rodriguez" />
						<AvatarFallback>MR</AvatarFallback>
						<AvatarBadge className="bg-tone-green">
							<span className="sr-only">Online</span>
						</AvatarBadge>
					</Avatar>
				</MessageAvatar>
				<MessageContent>
					<Bubble variant="muted">
						<BubbleContent>
							Only POST /api/checkout/confirm. p95 went from 240ms to 3.1s and the error rate is sitting at 4.2 percent. Every other route in the region is flat.
						</BubbleContent>
					</Bubble>
				</MessageContent>
			</Message>

			<Message align="end">
				<MessageAvatar>
					<Avatar>
						<AvatarImage src={SARAH_AVATAR} alt="Sarah Chen" />
						<AvatarFallback>SC</AvatarFallback>
					</Avatar>
				</MessageAvatar>
				<MessageContent>
					<Bubble>
						<BubbleContent>Pulling the traces for that window now.</BubbleContent>
					</Bubble>
				</MessageContent>
			</Message>
		</div>
	);
}
