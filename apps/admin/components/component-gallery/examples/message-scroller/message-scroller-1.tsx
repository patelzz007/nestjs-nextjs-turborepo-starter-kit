import * as React from "react";
import { SparklesIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import { Bubble, BubbleContent } from "@workspace/ui/components/bubble";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Message, MessageAvatar, MessageContent } from "@workspace/ui/components/message";
import {
	MessageScroller,
	MessageScrollerButton,
	MessageScrollerContent,
	MessageScrollerItem,
	MessageScrollerProvider,
	MessageScrollerViewport,
} from "@workspace/ui/components/message-scroller";
import { turnParagraphs, type TurnParagraph } from "@/components/component-gallery/examples/message-scroller/message-scroller-paragraphs";

interface Turn {
	id: string;
	role: "user" | "assistant";
	author: string;
	text: string;
}

const VIEWER_AVATAR = "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=96&h=96&dpr=2&q=80";

/*
 * Ids are thread scoped and stable across renders. That is what lets a row be
 * addressed later by scrollToMessage, and what the prepend restore uses to keep
 * a specific row under the reader. Index keys would break both.
 */
const TURNS: Turn[] = [
	{
		id: "th_9f2k4m_1",
		role: "user",
		author: "Jonas Weber",
		text: "Our Stripe webhook is returning 500 on charge.refunded. It started at 09:42 and 41 events are queued behind it.",
	},
	{
		id: "th_9f2k4m_2",
		role: "assistant",
		author: "Nimbus",
		text: "The handler throws before it acknowledges, so Stripe keeps redelivering the same event.\n\nEvery retry lands on the same code path, which is why the queue grows instead of draining. No other event type on that endpoint is affected.",
	},
	{
		id: "th_9f2k4m_3",
		role: "user",
		author: "Jonas Weber",
		text: "What is actually throwing?",
	},
	{
		id: "th_9f2k4m_4",
		role: "assistant",
		author: "Nimbus",
		text: "The refund branch reads charge.payment_intent, and that field is null for refunds created in the dashboard.\n\nThe null reaches the lookup helper, which throws before the 200 goes out. Card refunds carry the intent, dashboard refunds do not, so it only fires for a subset.",
	},
	{
		id: "th_9f2k4m_5",
		role: "user",
		author: "Jonas Weber",
		text: "Can we drain the queue without shipping anything?",
	},
	{
		id: "th_9f2k4m_6",
		role: "assistant",
		author: "Nimbus",
		text: "Not safely. The queued events replay the same branch, so they would fail again and burn the retries you have left.\n\nShip the guard first, then replay. Stripe keeps failed events for three days, so the 41 are not at risk yet.",
	},
	{
		id: "th_9f2k4m_7",
		role: "user",
		author: "Jonas Weber",
		text: "Give me the smallest patch that unblocks it.",
	},
	{
		id: "th_9f2k4m_8",
		role: "assistant",
		author: "Nimbus",
		text: "Return 200 as soon as the signature verifies, then do the refund work on a queue. A webhook acknowledges receipt, not success.\n\nWith that in place a null payment_intent becomes a job that fails and retries on your side, instead of a 500 Stripe has to redeliver.",
	},
	{
		id: "th_9f2k4m_9",
		role: "assistant",
		author: "Nimbus",
		text: "I drafted the change on a branch and left the replay script beside it. Want me to open the pull request?",
	},
];

export function MessageScroller1Example(): React.JSX.Element {
	return (
		/*
		 * The scroller fills a height constrained parent, so the frame owns the
		 * height and the transcript overflows inside it. Drop the fixed height and
		 * the page becomes the scroll container, which is a different component.
		 */
		<Card className="h-100 w-full max-w-2xl gap-0 overflow-hidden py-0">
			<CardHeader className="shrink-0 border-b py-4">
				<CardTitle>Stripe webhook 500s on charge.refunded</CardTitle>
				<CardDescription>th_9f2k4m, 9 messages</CardDescription>
			</CardHeader>
			<CardContent className="min-h-0 flex-1 p-0">
				<MessageScrollerProvider>
					<MessageScroller>
						{/*
						 * The viewport already ships role="region" and tabIndex 0, so the
						 * transcript is keyboard scrollable with no prop of ours. The label
						 * is the one default worth replacing per surface.
						 */}
						<MessageScrollerViewport aria-label="Webhook incident transcript">
							<MessageScrollerContent className="gap-5 p-(--card-spacing)">
								{TURNS.map((turn) => {
									const isUser = turn.role === "user";

									return (
										/*
										 * scrollAnchor marks the row that starts an exchange. It is
										 * what last-anchor opening and the previous item peek read,
										 * so it goes on the question, never on the answer.
										 */
										<MessageScrollerItem key={turn.id} messageId={turn.id} scrollAnchor={isUser}>
											<Message align={isUser ? "end" : "start"}>
												<MessageAvatar className="size-8">
													{isUser ? (
														<Avatar>
															<AvatarImage src={VIEWER_AVATAR} alt={turn.author} />
															<AvatarFallback>JW</AvatarFallback>
														</Avatar>
													) : (
														<>
															<SparklesIcon aria-hidden="true" className="size-4 text-muted-foreground" />
															<span className="sr-only">{turn.author}</span>
														</>
													)}
												</MessageAvatar>
												<MessageContent>
													<Bubble variant={isUser ? "muted" : "ghost"} align={isUser ? "end" : "start"}>
														<BubbleContent className="space-y-2">
															{turnParagraphs(turn.text).map((paragraph: TurnParagraph): React.JSX.Element => (
																<p key={paragraph.id} className="whitespace-pre-wrap">
																	{paragraph.text}
																</p>
															))}
														</BubbleContent>
													</Bubble>
												</MessageContent>
											</Message>
										</MessageScrollerItem>
									);
								})}
							</MessageScrollerContent>
						</MessageScrollerViewport>
						{/*
						 * A sibling of the viewport, never a child of it: the root is the
						 * positioning context, so inside the viewport the control would
						 * scroll away with the messages.
						 */}
						<MessageScrollerButton label="Scroll to the latest message" variant="outline" className="rounded-full shadow-sm" />
					</MessageScroller>
				</MessageScrollerProvider>
			</CardContent>
		</Card>
	);
}
