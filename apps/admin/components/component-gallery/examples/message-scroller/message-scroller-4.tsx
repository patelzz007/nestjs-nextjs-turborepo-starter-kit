"use client";

import * as React from "react";
import { useCallback, useState } from "react";
import { z } from "zod";

import { Bubble, BubbleContent } from "@workspace/ui/components/bubble";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Marker, MarkerContent } from "@workspace/ui/components/marker";
import { Message, MessageContent } from "@workspace/ui/components/message";
import {
	MessageScroller,
	MessageScrollerButton,
	MessageScrollerContent,
	MessageScrollerItem,
	MessageScrollerProvider,
	MessageScrollerViewport,
} from "@workspace/ui/components/message-scroller";
import { Tabs, TabsList, TabsTrigger } from "@workspace/ui/components/tabs";
import { turnParagraphs, type TurnParagraph } from "@/components/component-gallery/examples/message-scroller/message-scroller-paragraphs";

/** Where the scroller anchors; also the Tabs' values, parsed back from the untyped tab value. */
const PositionSchema = z.enum(["start", "end", "last-anchor"]);
type Position = z.infer<typeof PositionSchema>;
type TabsValueChange = NonNullable<React.ComponentProps<typeof Tabs>["onValueChange"]>;

interface Turn {
	id: string;
	role: "user" | "assistant";
	text: string;
}

const POSITIONS: Position[] = ["start", "end", "last-anchor"];

/*
 * The closing exchange is deliberately taller than the frame. When the last
 * turn fits, end and last-anchor resolve to the same place and the difference
 * between the two options is invisible.
 */
const TURNS: Turn[] = [
	{
		id: "th_2m6r7d_1",
		role: "user",
		text: "Churn is up for the second month running. Where is it concentrated?",
	},
	{
		id: "th_2m6r7d_2",
		role: "assistant",
		text: "Almost all of it is on the starter tier, and almost all of that is inside the first 30 days.\n\nGrowth and scale are flat within noise, so nothing here points at a pricing problem on the paid tiers.",
	},
	{
		id: "th_2m6r7d_3",
		role: "user",
		text: "Is it the same accounts every month?",
	},
	{
		id: "th_2m6r7d_4",
		role: "assistant",
		text: "No. The starter cohort turns over completely, which makes this a first month experience problem rather than a slow leak.\n\nAccounts that survive month one behave like every other cohort we have measured.",
	},
	{
		id: "th_2m6r7d_5",
		role: "user",
		text: "What do the ones who leave do before they go?",
	},
	{
		id: "th_2m6r7d_6",
		role: "assistant",
		text: "They create a workspace, import once, and never invite anyone.\n\nA second seat is the strongest single predictor we have. Accounts that add one in the first week churn at about a third of the rate.",
	},
	{
		id: "th_2m6r7d_7",
		role: "user",
		text: "Give me the full breakdown so I can take it into the pricing review.",
	},
	{
		id: "th_2m6r7d_8",
		role: "assistant",
		text: "Starter is 84 percent of cancellations and 11 percent of revenue, so the revenue impact is much smaller than the count suggests. Median tenure before cancelling is 19 days.\n\nGrowth is 9 percent of cancellations and 38 percent of revenue, with a median tenure over 11 months, and most of those are consolidations onto one annual plan rather than losses. Scale is the remaining 7 percent, all contract driven and all known in advance.\n\nThe recommendation is to stop reading this as one number. Starter churn is an activation problem and belongs to onboarding, growth churn is a plan shape problem, and scale churn is a renewal conversation that already has an owner.",
	},
];

export function MessageScroller4Example(): React.JSX.Element {
	const [position, setPosition] = useState<Position>("last-anchor");
	const handlePositionChange = useCallback<TabsValueChange>((value): void => {
		const parsed = PositionSchema.safeParse(value);
		if (parsed.success) {
			setPosition(parsed.data);
		}
	}, []);

	return (
		<Card className="h-120 w-full max-w-2xl gap-0 overflow-hidden py-0">
			<CardHeader className="shrink-0 border-b py-4">
				<CardTitle>Churn by plan tier</CardTitle>
				<CardDescription>Reopened 3 days later</CardDescription>
			</CardHeader>
			<CardContent className="min-h-0 flex-1 p-0">
				{/*
				 * defaultScrollPosition decides where a thread opens, it is not a
				 * scroll command. The provider re-applies it whenever the value
				 * changes, so a tab reads as reopening the thread rather than moving
				 * inside it.
				 */}
				<MessageScrollerProvider defaultScrollPosition={position}>
					<MessageScroller>
						<MessageScrollerViewport aria-label="Saved thread transcript">
							<MessageScrollerContent className="gap-5 p-(--card-spacing)">
								{/*
								 * The day divider gives the start position something to land
								 * on. Without a leading row, start and the first turn resolve
								 * to the same pixel and the option looks broken.
								 */}
								<MessageScrollerItem scrollAnchor={false}>
									<Marker variant="separator">
										<MarkerContent>Tuesday</MarkerContent>
									</Marker>
								</MessageScrollerItem>
								{TURNS.map((turn) => {
									const isUser = turn.role === "user";

									return (
										/*
										 * last-anchor keys on scrollAnchor, not on the role. With
										 * no anchor in the tree, or when the last turn already fits
										 * the viewport, it falls back to end.
										 */
										<MessageScrollerItem key={turn.id} messageId={turn.id} scrollAnchor={isUser}>
											<Message align={isUser ? "end" : "start"}>
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
				</MessageScrollerProvider>
			</CardContent>
			<CardFooter className="shrink-0 border-t py-4">
				{/*
				 * The twins hand this callback different argument types, so the value
				 * is narrowed here rather than cast at the call site. One body then
				 * compiles and behaves identically in both.
				 */}
				<Tabs value={position} onValueChange={handlePositionChange} className="w-full">
					<TabsList className="w-full">
						{POSITIONS.map((option) => (
							<TabsTrigger key={option} value={option}>
								{option}
							</TabsTrigger>
						))}
					</TabsList>
				</Tabs>
			</CardFooter>
		</Card>
	);
}
