"use client";

import * as React from "react";
import { SparklesIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@workspace/ui/components/badge";

import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import { Bubble, BubbleContent } from "@workspace/ui/components/bubble";
import { Button } from "@workspace/ui/components/button";
import { Card, CardAction, CardContent, CardFooter, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Message, MessageAvatar, MessageContent } from "@workspace/ui/components/message";
import {
	MessageScroller,
	MessageScrollerButton,
	MessageScrollerContent,
	MessageScrollerItem,
	MessageScrollerProvider,
	MessageScrollerViewport,
} from "@workspace/ui/components/message-scroller";
import { Spinner } from "@workspace/ui/components/spinner";
import { turnParagraphs, type TurnParagraph } from "@/components/component-gallery/examples/message-scroller/message-scroller-paragraphs";

interface Turn {
	id: string;
	role: "user" | "assistant";
	author: string;
	text: string;
}

const VIEWER_AVATAR = "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=96&h=96&dpr=2&q=80";

const REPLY_ID = "th_7c1x8p_reply";

const SETTLED: Turn[] = [
	{
		id: "th_7c1x8p_1",
		role: "user",
		author: "Jonas Weber",
		text: "I want to reproduce the refund 500 locally before we patch anything.",
	},
	{
		id: "th_7c1x8p_2",
		role: "assistant",
		author: "Nimbus",
		text: "Point the Stripe CLI at your local endpoint and trigger charge.refunded.\n\nA dashboard style refund arrives with no payment_intent, which is the exact shape production is failing on.",
	},
	{
		id: "th_7c1x8p_3",
		role: "user",
		author: "Jonas Weber",
		text: "The CLI payload has a payment_intent on it though.",
	},
	{
		id: "th_7c1x8p_4",
		role: "assistant",
		author: "Nimbus",
		text: "That is the default fixture. Override the field to null and the handler takes the branch you care about.\n\nThe rest of the fixture can stay as it is, the failing helper reads that one field and nothing else.",
	},
	{
		id: "th_7c1x8p_5",
		role: "user",
		author: "Jonas Weber",
		text: "Reproduced it, the 500 is right there in the log.",
	},
	{
		id: "th_7c1x8p_6",
		role: "assistant",
		author: "Nimbus",
		text: "That log line is the lookup helper throwing, three frames above the response.",
	},
	{
		id: "th_7c1x8p_7",
		role: "user",
		author: "Jonas Weber",
		text: "So what does the smallest safe fix look like?",
	},
];

/*
 * The reply is sliced out of one module scope string. A real client appends
 * decoded chunks instead, but the DOM churn the scroller has to absorb while a
 * row grows is the same either way.
 */
const REPLY =
	"Move the acknowledgement above the work. Verify the signature, return 200, then hand the event to a queue.\n\nAfter that a null payment_intent is a job that retries on your own backoff, and Stripe sees a healthy endpoint the whole time. It also means one slow refund lookup can no longer time the webhook out.";

/** The simulated stream reveals this many characters per tick. */
const STREAM_CHARS_PER_TICK = 4;
const STREAM_TICK_MS = 28;

export function MessageScroller2Example(): React.JSX.Element {
	const [length, setLength] = useState(0);

	/*
	 * One timeout per slice rather than an interval: a backgrounded tab throttles
	 * timers instead of queueing a burst of them, so the stream resumes where it
	 * stopped instead of jumping.
	 */
	useEffect((): (() => void) | undefined => {
		if (length >= REPLY.length) {
			return undefined;
		}
		const id = window.setTimeout((): void => {
			setLength((value: number): number => value + STREAM_CHARS_PER_TICK);
		}, STREAM_TICK_MS);
		return (): void => {
			window.clearTimeout(id);
		};
	}, [length]);

	const handleReplay = useCallback((): void => {
		setLength(0);
	}, []);

	const done = length >= REPLY.length;

	/* The in flight row is built during render from the slice counter, so no
     state mirrors the text that is already derivable from it. */
	const turns: Turn[] = [
		...SETTLED,
		{
			id: REPLY_ID,
			role: "assistant",
			author: "Nimbus",
			text: REPLY.slice(0, length),
		},
	];

	return (
		/*
		 * The frame owns the height and the scroller fills it. Without a bounded
		 * parent there is no overflow to follow, and autoScroll has nothing to do
		 * because the page itself is doing the scrolling.
		 */
		<Card className="h-115 w-full max-w-2xl gap-0 overflow-hidden py-0">
			<CardHeader className="shrink-0 border-b py-4">
				<CardTitle>Reproduce webhook failure</CardTitle>
				<CardAction>
					<Badge variant={done ? "success-light" : "primary-light"}>{done ? "Answered" : "Working"}</Badge>
				</CardAction>
			</CardHeader>
			<CardContent className="min-h-0 flex-1 p-0">
				{/*
				 * autoScroll follows the output only while the reader is already at the
				 * live edge. Any scroll intent releases it and their place is kept, and
				 * the jump to latest control re-engages it.
				 */}
				<MessageScrollerProvider autoScroll>
					<MessageScroller>
						<MessageScrollerViewport aria-label="Live agent run transcript">
							{/*
							 * aria-busy silences the log while tokens land, so the finished
							 * row is announced once instead of per chunk. That is why the in
							 * flight state is announced from a status node outside it, and
							 * why the spinner itself is hidden from assistive tech.
							 */}
							<MessageScrollerContent aria-busy={!done} className="gap-5 p-(--card-spacing)">
								{turns.map((turn) => {
									const isUser = turn.role === "user";
									const isStreaming = turn.id === REPLY_ID && !done;

									return (
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
															{isStreaming ? <Spinner className="size-3" aria-hidden="true" /> : null}
														</BubbleContent>
													</Bubble>
												</MessageContent>
											</Message>
										</MessageScrollerItem>
									);
								})}
							</MessageScrollerContent>
						</MessageScrollerViewport>
						<p role="status" aria-live="polite" className="sr-only">
							{done ? "Reply complete" : "Nimbus is replying"}
						</p>
						<MessageScrollerButton label="Scroll to the latest message" variant="outline" className="rounded-full shadow-sm" />
					</MessageScroller>
				</MessageScrollerProvider>
			</CardContent>
			<CardFooter className="shrink-0 border-t py-4">
				<Button variant="outline" size="sm" onClick={handleReplay}>
					Replay stream
				</Button>
			</CardFooter>
		</Card>
	);
}
