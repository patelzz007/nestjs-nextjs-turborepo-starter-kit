"use client";

import * as React from "react";
import { useCallback } from "react";
import { ChevronDownIcon, ChevronUpIcon, SparklesIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import { Bubble, BubbleContent } from "@workspace/ui/components/bubble";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Message, MessageAvatar, MessageContent } from "@workspace/ui/components/message";
import {
	MessageScroller,
	MessageScrollerButton,
	MessageScrollerContent,
	MessageScrollerItem,
	MessageScrollerProvider,
	MessageScrollerViewport,
	useMessageScroller,
	useMessageScrollerVisibility,
} from "@workspace/ui/components/message-scroller";
import { turnParagraphs, type TurnParagraph } from "@/components/component-gallery/examples/message-scroller/message-scroller-paragraphs";

interface Turn {
	id: string;
	role: "user" | "assistant";
	author: string;
	text: string;
}

const VIEWER_AVATAR = "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=96&h=96&dpr=2&q=80";

const TURNS: Turn[] = [
	{
		id: "th_8n4d7s_q1",
		role: "user",
		author: "Jonas Weber",
		text: "Walk me through the export incident from Friday.",
	},
	{
		id: "th_8n4d7s_2",
		role: "assistant",
		author: "Nimbus",
		text: "It ran from 09:42 to 11:06. One workspace saw empty exports and nobody saw an error.\n\nThe trigger was a saved view whose date range excluded everything recent, and an export inherits the active view.",
	},
	{
		id: "th_8n4d7s_3",
		role: "assistant",
		author: "Nimbus",
		text: "No data was lost, and no other workspace was affected.",
	},
	{
		id: "th_8n4d7s_q2",
		role: "user",
		author: "Jonas Weber",
		text: "Why did it take 84 minutes to find?",
	},
	{
		id: "th_8n4d7s_5",
		role: "assistant",
		author: "Nimbus",
		text: "Because every signal read healthy. The jobs completed, the queue drained, and the error rate never moved.\n\nWe found it when support tied the ticket to the view change, not from an alert.",
	},
	{
		id: "th_8n4d7s_q3",
		role: "user",
		author: "Jonas Weber",
		text: "What would have caught it sooner?",
	},
	{
		id: "th_8n4d7s_7",
		role: "assistant",
		author: "Nimbus",
		text: "A zero row export from a workspace that exported thousands the day before. That is the signal we do not have yet.\n\nIt is cheap to add, because the job already records the row count it wrote.",
	},
	{
		id: "th_8n4d7s_8",
		role: "assistant",
		author: "Nimbus",
		text: "I drafted the threshold as a ratio rather than an absolute, so a genuinely small workspace never pages anyone.",
	},
	{
		id: "th_8n4d7s_q4",
		role: "user",
		author: "Jonas Weber",
		text: "Is the dialog change still the right fix?",
	},
	{
		id: "th_8n4d7s_10",
		role: "assistant",
		author: "Nimbus",
		text: "Yes, and it stands on its own next to the alert. The dialog renders its row count after the request, so a zero currently reads as loading.\n\nShowing the active filter with a settled count turns a silent wrong answer into an obvious one.",
	},
	{
		id: "th_8n4d7s_q5",
		role: "user",
		author: "Jonas Weber",
		text: "Write it up for the review on Thursday.",
	},
	{
		id: "th_8n4d7s_12",
		role: "assistant",
		author: "Nimbus",
		text: "Written. Timeline, contributing factors, and the two actions with owners and dates.\n\nI kept the blameless framing and moved the raw timeline into an appendix, so the meeting can stay on the actions.",
	},
];

/*
 * The navigator addresses rows by messageId, and only a row that carries one is
 * registered with scrollToMessage. Anchoring and prepend detection work without
 * an id, jumping does not.
 */
const QUESTIONS = TURNS.filter((turn) => turn.role === "user");

function TurnNavigator(): React.JSX.Element {
	const { scrollToMessage } = useMessageScroller();
	const { currentAnchorId } = useMessageScrollerVisibility();

	/*
	 * The position is derived during render from the reported anchor. Mirroring
	 * it into state would need an effect, and that effect would fight every
	 * smooth scroll it started.
	 */
	const index = Math.max(
		0,
		QUESTIONS.findIndex((question) => question.id === currentAnchorId),
	);
	const current = QUESTIONS.at(index);

	/*
	 * align start puts the question at the top of the viewport with the
	 * provider's scroll margin above it, so a jump lands on the question and the
	 * answer under it rather than halfway through the turn before.
	 */
	const goTo = useCallback(
		(nextIndex: number): void => {
			const target = QUESTIONS.at(nextIndex);
			if (target !== undefined) {
				scrollToMessage(target.id, { align: "start", behavior: "smooth" });
			}
		},
		[scrollToMessage],
	);
	const goToPrevious = useCallback((): void => {
		goTo(index - 1);
	}, [goTo, index]);
	const goToNext = useCallback((): void => {
		goTo(index + 1);
	}, [goTo, index]);

	return (
		<div className="flex w-full min-w-0 items-center gap-2">
			<Button variant="ghost" size="icon-sm" aria-label="Previous turn" disabled={index <= 0} onClick={goToPrevious}>
				<ChevronUpIcon aria-hidden="true" />
			</Button>
			<span className="min-w-0 flex-1 truncate text-center text-sm text-muted-foreground">
				<span className="font-medium text-foreground">
					Turn {String(index + 1)} of {String(QUESTIONS.length)}
				</span>{" "}
				{current?.text}
			</span>
			<Button variant="ghost" size="icon-sm" aria-label="Next turn" disabled={index >= QUESTIONS.length - 1} onClick={goToNext}>
				<ChevronDownIcon aria-hidden="true" />
			</Button>
		</div>
	);
}

export function MessageScroller6Example(): React.JSX.Element {
	return (
		/*
		 * The frame owns the height, and the Provider wraps the whole card body so
		 * the footer can read and drive the transcript while sitting outside the
		 * scroll region.
		 */
		<Card className="h-115 w-full max-w-2xl gap-0 overflow-hidden py-0">
			<MessageScrollerProvider scrollMargin={12}>
				<CardHeader className="shrink-0 border-b py-4">
					<CardTitle>Export incident review</CardTitle>
					<CardDescription>5 questions, 12 messages</CardDescription>
				</CardHeader>
				<CardContent className="min-h-0 flex-1 p-0">
					<MessageScroller>
						<MessageScrollerViewport aria-label="Incident review transcript">
							<MessageScrollerContent className="gap-5 p-(--card-spacing)">
								{TURNS.map((turn) => {
									const isUser = turn.role === "user";

									return (
										/*
										 * Only the questions carry an anchor, so the reported
										 * anchor stays on a turn after it scrolls above the fold.
										 * That is what makes it answer where the reader is rather
										 * than what happens to be on screen.
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
						<MessageScrollerButton label="Scroll to the latest message" variant="outline" className="rounded-full shadow-sm" />
					</MessageScroller>
				</CardContent>
				<CardFooter className="shrink-0 border-t py-4">
					{/*
					 * Visibility tracking only runs while something subscribes to it, so
					 * a transcript without a navigator pays nothing for the observer this
					 * footer turns on.
					 */}
					<TurnNavigator />
				</CardFooter>
			</MessageScrollerProvider>
		</Card>
	);
}
