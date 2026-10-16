"use client";

import * as React from "react";
import { ArrowUpIcon, SparklesIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import { Bubble, BubbleContent } from "@workspace/ui/components/bubble";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@workspace/ui/components/input-group";
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

const SEEDED: Turn[] = [
	{
		id: "th_4b8t2v_1",
		role: "user",
		author: "Jonas Weber",
		text: "Draft the release notes for 3.4 from the merged pull requests.",
	},
	{
		id: "th_4b8t2v_2",
		role: "assistant",
		author: "Nimbus",
		text: "Here is a first pass, grouped the way the changelog already reads.\n\nTwo entries need a decision from you. The webhook acknowledgement change is breaking for anyone parsing the 500, and the export worker change moves a default.",
	},
	{
		id: "th_4b8t2v_3",
		role: "user",
		author: "Jonas Weber",
		text: "Keep the breaking one at the top.",
	},
	{
		id: "th_4b8t2v_4",
		role: "assistant",
		author: "Nimbus",
		text: "Moved. Breaking changes lead, then features, then fixes.\n\nI also pulled the migration note out of the fix list, because the people who skip that section are the ones who need it.",
	},
	{
		id: "th_4b8t2v_5",
		role: "assistant",
		author: "Nimbus",
		text: "The draft is in the shared doc. Ask for any section and I will rewrite it in place.",
	},
];

/* Canned answers, taken in turn so a second send never repeats verbatim. */
const REPLIES: readonly string[] = [
	"Pulled that into the draft. It sits under Breaking changes with the upgrade note directly beneath it.\n\nI kept the wording to a single line, since the detail belongs on the docs page the entry links to.",
	"Done, and I left the previous text beside it so you can compare the two.\n\nNothing else moved. The ordering rules are still breaking, then features, then fixes.",
	"That one needs a decision rather than an edit. The change sits behind a flag, so it reads as a feature for anyone who opts in and as nothing at all for everyone else.\n\nTell me which framing you want and I will write it both ways.",
];

/** How long Nimbus "thinks" before answering. */
const REPLY_DELAY_MS = 900;

export function MessageScroller3Example(): React.JSX.Element {
	const [sent, setSent] = useState<Turn[]>([]);
	const [draft, setDraft] = useState("");
	const replyTimer = useRef<number | null>(null);
	const replyCount = useRef(0);

	/*
	 * Only the unmount half lives here. The next question clears the pending
	 * timer inline, so a slow answer can never land after the tree is gone or
	 * attach itself to a question the reader has already replaced.
	 */
	useEffect((): (() => void) => {
		return (): void => {
			if (replyTimer.current !== null) {
				window.clearTimeout(replyTimer.current);
			}
		};
	}, []);

	const handleDraftChange = useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setDraft(event.target.value);
	}, []);

	/*
	 * The answer lands on a timer owned by a ref, not on an effect watching the
	 * message list. An effect would rerun on every unrelated change to that list
	 * and would have to guard itself out of answering its own output.
	 */
	const handleSubmit = useCallback(
		(event: React.SubmitEvent<HTMLFormElement>): void => {
			event.preventDefault();

			const question = draft.trim();
			if (question === "") {
				return;
			}

			/*
			 * Row ids come off a counter that only ever climbs, so a send can never
			 * reuse an id an earlier row still holds. Reused keys would remount the
			 * rows above and throw away the scroll position the anchor just set.
			 */
			const round = replyCount.current;
			replyCount.current += 1;
			setDraft("");
			setSent((current) => [
				...current,
				{
					id: `th_4b8t2v_q${String(round)}`,
					role: "user",
					author: "Jonas Weber",
					text: question,
				},
			]);

			if (replyTimer.current !== null) {
				window.clearTimeout(replyTimer.current);
			}
			replyTimer.current = window.setTimeout((): void => {
				replyTimer.current = null;
				setSent((current) => [
					...current,
					{
						id: `th_4b8t2v_a${String(round)}`,
						role: "assistant",
						author: "Nimbus",
						text: REPLIES.at(round % REPLIES.length) ?? "",
					},
				]);
			}, REPLY_DELAY_MS);
		},
		[draft],
	);

	/* Only the sent rows live in state. Copying the seeded transcript into state
     as well would let a stale update rewrite rows that never change. */
	const turns = [...SEEDED, ...sent];

	return (
		/*
		 * The frame owns the height, so the transcript overflows inside the card
		 * rather than lengthening the page. An anchored turn needs somewhere to
		 * move to, and a page tall enough to fit everything gives it nowhere.
		 */
		<Card className="h-120 w-full max-w-2xl gap-0 overflow-hidden py-0">
			<CardHeader className="shrink-0 border-b py-4">
				<CardTitle>Q3 release notes draft</CardTitle>
				<CardDescription>Anchored turns, 64px peek</CardDescription>
			</CardHeader>
			<CardContent className="min-h-0 flex-1 p-0">
				{/*
				 * The peek is only read on a row that carries scrollAnchor, so in a
				 * transcript with no anchors both props are inert and the view falls
				 * back to plain bottom following.
				 */}
				<MessageScrollerProvider scrollPreviousItemPeek={64} scrollMargin={16}>
					<MessageScroller>
						<MessageScrollerViewport aria-label="Release notes thread">
							<MessageScrollerContent className="gap-5 p-(--card-spacing)">
								{turns.map((turn) => {
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
							</MessageScrollerContent>
						</MessageScrollerViewport>
						<MessageScrollerButton label="Scroll to the latest message" variant="outline" className="rounded-full shadow-sm" />
					</MessageScroller>
				</MessageScrollerProvider>
			</CardContent>
			<CardFooter className="shrink-0 border-t py-4">
				{/*
				 * A real form, so the button and Enter inside the field go through one
				 * handler. An onClick only button is still reachable by keyboard, but it
				 * leaves Enter in the field doing nothing at all.
				 */}
				<form className="w-full" onSubmit={handleSubmit}>
					<InputGroup>
						<InputGroupInput aria-label="Message Nimbus" placeholder="Ask about the 3.4 release notes" value={draft} onChange={handleDraftChange} />
						<InputGroupAddon align="inline-end">
							<InputGroupButton type="submit" size="icon-sm" variant="default" disabled={!draft.trim()}>
								<ArrowUpIcon aria-hidden="true" />
								<span className="sr-only">Send</span>
							</InputGroupButton>
						</InputGroupAddon>
					</InputGroup>
				</form>
			</CardFooter>
		</Card>
	);
}
