"use client";

import * as React from "react";
import { SparklesIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "@workspace/ui/components/badge";

import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import { Bubble, BubbleContent } from "@workspace/ui/components/bubble";
import { Button } from "@workspace/ui/components/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Marker, MarkerContent } from "@workspace/ui/components/marker";
import { Message, MessageAvatar, MessageContent } from "@workspace/ui/components/message";
import {
	MessageScroller,
	MessageScrollerButton,
	MessageScrollerContent,
	MessageScrollerItem,
	MessageScrollerProvider,
	MessageScrollerViewport,
	useMessageScrollerScrollable,
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

const INITIAL_VISIBLE = 6;

/*
 * Sixteen rows against a six row window, so there is real history to reveal
 * and the restored position is somewhere in the middle rather than at an edge
 * where any implementation would look correct.
 */
const HISTORY: Turn[] = [
	{
		id: "th_5p3w9k_1",
		role: "user",
		author: "Jonas Weber",
		text: "Pulling up ticket 4821. The customer says their exports have been empty since Friday.",
	},
	{
		id: "th_5p3w9k_2",
		role: "assistant",
		author: "Nimbus",
		text: "Empty, not failing. Every job in that window finished with a zero row result.",
	},
	{
		id: "th_5p3w9k_3",
		role: "user",
		author: "Jonas Weber",
		text: "Same workspace every time?",
	},
	{
		id: "th_5p3w9k_4",
		role: "assistant",
		author: "Nimbus",
		text: "One workspace, ws_3311. No other account shows the pattern.",
	},
	{
		id: "th_5p3w9k_5",
		role: "user",
		author: "Jonas Weber",
		text: "What changed for them on Friday?",
	},
	{
		id: "th_5p3w9k_6",
		role: "assistant",
		author: "Nimbus",
		text: "They moved their default view onto a saved filter whose date range ends last Thursday.",
	},
	{
		id: "th_5p3w9k_7",
		role: "user",
		author: "Jonas Weber",
		text: "So the export is right and the filter is wrong.",
	},
	{
		id: "th_5p3w9k_8",
		role: "assistant",
		author: "Nimbus",
		text: "Right for the filter, yes. The export inherits the active view, and that view now excludes everything recent.",
	},
	{
		id: "th_5p3w9k_9",
		role: "user",
		author: "Jonas Weber",
		text: "Does the interface show them that range anywhere?",
	},
	{
		id: "th_5p3w9k_10",
		role: "assistant",
		author: "Nimbus",
		text: "Only inside the filter chip, which is collapsed by default at their screen width.",
	},
	{
		id: "th_5p3w9k_11",
		role: "user",
		author: "Jonas Weber",
		text: "That is the actual bug then.",
	},
	{
		id: "th_5p3w9k_12",
		role: "assistant",
		author: "Nimbus",
		text: "It is at least why nobody caught it. The export dialog does show a row count, but it renders after the request, so a zero reads as loading.",
	},
	{
		id: "th_5p3w9k_13",
		role: "user",
		author: "Jonas Weber",
		text: "Can we tell them what to change today?",
	},
	{
		id: "th_5p3w9k_14",
		role: "assistant",
		author: "Nimbus",
		text: "Clear the saved range on the view, or export from the unfiltered table. Either one gives them Friday onward straight away.",
	},
	{
		id: "th_5p3w9k_15",
		role: "user",
		author: "Jonas Weber",
		text: "Send that, then flag the dialog for the product review.",
	},
	{
		id: "th_5p3w9k_16",
		role: "assistant",
		author: "Nimbus",
		text: "Sent, and the dialog is on the review list with a screenshot attached.\n\nI left a note on the ticket too, so the next person reads the filter before they open the worker logs.",
	},
];

/*
 * The chip sits outside the scroll frame but inside the Provider. Every hook
 * resolves through that context, so a control in the header still has to be a
 * descendant of it.
 */
/** Each "load earlier" adds this many messages, after a short simulated fetch. */
const PAGE_SIZE = 5;
const LOAD_DELAY_MS = 700;

function HistoryChip(): React.JSX.Element {
	const { start } = useMessageScrollerScrollable();

	return <Badge variant="info-light">{start ? "Earlier messages above" : "Top of thread"}</Badge>;
}

export function MessageScroller5Example(): React.JSX.Element {
	const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);
	const [loading, setLoading] = useState(false);
	const loadTimer = useRef<number | null>(null);

	useEffect((): (() => void) => {
		return (): void => {
			if (loadTimer.current !== null) {
				window.clearTimeout(loadTimer.current);
			}
		};
	}, []);

	/*
	 * The window is a slice taken during render, so loading earlier messages is
	 * only a longer slice. That is the same shape a cursor paginated endpoint
	 * produces, and it keeps the already mounted rows identical.
	 */
	const visible = HISTORY.slice(-visibleCount);
	const allLoaded = visibleCount >= HISTORY.length;

	/* The delay is a real beat rather than decoration, so the restored scroll
     position is measured against rows that arrived after a paint. */
	const loadEarlier = useCallback((): void => {
		if (loading || allLoaded) {
			return;
		}

		setLoading(true);
		loadTimer.current = window.setTimeout((): void => {
			loadTimer.current = null;
			setVisibleCount((count: number): number => Math.min(count + PAGE_SIZE, HISTORY.length));
			setLoading(false);
		}, LOAD_DELAY_MS);
	}, [allLoaded, loading]);

	return (
		/*
		 * The frame owns the height. Restoring a scroll position only means
		 * something while the reader is inside a bounded region, so a card that
		 * grew with its content would have nothing to preserve.
		 */
		<Card className="h-110 w-full max-w-2xl gap-0 overflow-hidden py-0">
			<MessageScrollerProvider>
				{/*
				 * The load control lives in the header, never as the first row of the
				 * content. A prepend is detected by the previously first row moving to
				 * an index above zero, so a permanent loader row at the top never moves
				 * and the restore would never fire.
				 */}
				<CardHeader className="shrink-0 border-b py-4">
					<CardTitle>Support escalation</CardTitle>
					<CardDescription className="flex items-center gap-2">
						<HistoryChip />
						<span>
							{visible.length} of {HISTORY.length} messages
						</span>
					</CardDescription>
					<CardAction>
						<Button variant="outline" size="sm" disabled={loading || allLoaded} onClick={loadEarlier}>
							{loading ? <Spinner className="size-3" aria-hidden="true" /> : null}
							{allLoaded ? "All loaded" : "Load earlier"}
						</Button>
					</CardAction>
				</CardHeader>
				<CardContent className="min-h-0 flex-1 p-0">
					<MessageScroller>
						{/*
						 * preserveScrollOnPrepend is on by default. Stable ids are what
						 * give it a specific row to hold under the reader, so a list keyed
						 * by index loses the behavior without any error.
						 */}
						<MessageScrollerViewport aria-label="Support escalation transcript">
							<MessageScrollerContent className="gap-5 p-(--card-spacing)">
								{visible.map((turn) => {
									const isUser = turn.role === "user";

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
														</BubbleContent>
													</Bubble>
												</MessageContent>
											</Message>
										</MessageScrollerItem>
									);
								})}
								{/*
								 * A row with no messageId still counts for prepend detection
								 * and for anchoring, it is only invisible to scrollToMessage
								 * and to visibility tracking. A divider wants exactly that.
								 */}
								<MessageScrollerItem scrollAnchor={false}>
									<Marker variant="separator">
										<MarkerContent>Escalated to Sam Okafor</MarkerContent>
									</Marker>
								</MessageScrollerItem>
							</MessageScrollerContent>
						</MessageScrollerViewport>
						<MessageScrollerButton label="Scroll to the latest message" variant="outline" className="rounded-full shadow-sm" />
					</MessageScroller>
				</CardContent>
			</MessageScrollerProvider>
		</Card>
	);
}
