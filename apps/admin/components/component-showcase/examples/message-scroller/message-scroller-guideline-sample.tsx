"use client";

// The transcript the Do / Don't pairs show: a short support chat that opens at its newest or its first message, and
// either follows new messages only while the reader is at the end (with a jump back) or yanks them down on every one.

import { Bubble, BubbleContent } from "@workspace/ui/components/bubble";
import { Message, MessageContent } from "@workspace/ui/components/message";
import {
	MessageScroller,
	MessageScrollerButton,
	MessageScrollerContent,
	MessageScrollerItem,
	MessageScrollerProvider,
	MessageScrollerViewport,
	useMessageScroller,
} from "@workspace/ui/components/message-scroller";
import * as React from "react";

interface Turn {
	readonly id: string;
	readonly fromViewer: boolean;
	readonly text: string;
}

const OPENING: readonly Turn[] = Array.from({ length: 12 }, (_, index: number): Turn => ({
	id: `turn-${String(index + 1)}`,
	fromViewer: index % 2 === 1,
	text: index % 2 === 1 ? `Still seeing the error after step ${String(index)}.` : `Try step ${String(index + 1)}: clear the cache and sign in again.`,
}));

/** A new reply arrives this often while the transcript is on screen. */
const REPLY_EVERY_MS = 4_000;

/** Pulls the reader to the newest message every time one arrives, wherever they were reading. */
function ForceFollow({ lastId }: { readonly lastId: string }): null {
	const { scrollToMessage } = useMessageScroller();
	React.useEffect((): void => {
		scrollToMessage(lastId);
	}, [lastId, scrollToMessage]);
	return null;
}

export interface GuidelineTranscriptProps {
	/** Where the transcript opens. */
	readonly opensAt: "start" | "end";
	/** Every new message drags the reader to it. */
	readonly forceFollow: boolean;
}

export function GuidelineTranscript({ opensAt, forceFollow }: GuidelineTranscriptProps): React.JSX.Element {
	const [turns, setTurns] = React.useState<readonly Turn[]>(OPENING);
	React.useEffect((): (() => void) => {
		const timer = window.setInterval((): void => {
			setTurns((current: readonly Turn[]): readonly Turn[] => [
				...current,
				{ id: `turn-${String(current.length + 1)}`, fromViewer: false, text: "Here is one more thing to try." },
			]);
		}, REPLY_EVERY_MS);
		return (): void => {
			window.clearInterval(timer);
		};
	}, []);
	const last = turns.at(-1);
	return (
		<div className="flex h-72 w-full max-w-md flex-col overflow-hidden rounded-lg border">
			<MessageScrollerProvider defaultScrollPosition={opensAt} autoScroll={!forceFollow}>
				<MessageScroller>
					<MessageScrollerViewport aria-label="Support chat">
						<MessageScrollerContent className="gap-3 p-3">
							{turns.map((turn: Turn): React.JSX.Element => (
								<MessageScrollerItem key={turn.id} messageId={turn.id}>
									<Message align={turn.fromViewer ? "end" : "start"}>
										<MessageContent>
											<Bubble variant={turn.fromViewer ? "default" : "muted"}>
												<BubbleContent>{turn.text}</BubbleContent>
											</Bubble>
										</MessageContent>
									</Message>
								</MessageScrollerItem>
							))}
						</MessageScrollerContent>
					</MessageScrollerViewport>
					{forceFollow ? null : <MessageScrollerButton label="Jump to the newest message" />}
				</MessageScroller>
				{forceFollow && last !== undefined ? <ForceFollow lastId={last.id} /> : null}
			</MessageScrollerProvider>
		</div>
	);
}
