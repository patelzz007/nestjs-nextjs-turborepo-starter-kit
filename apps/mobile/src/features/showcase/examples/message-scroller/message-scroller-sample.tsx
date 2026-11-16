// What the MessageScroller examples share: a support conversation as question-and-answer turns, one turn drawn as a
// sent question and a received answer, and the scroller in a fixed-height frame with a jump to the latest message.

import { Bubble } from "@workspace/ui-native/components/bubble";
import {
	MessageScroller,
	MessageScrollerButton,
	MessageScrollerContent,
	MessageScrollerItem,
	MessageScrollerViewport,
} from "@workspace/ui-native/components/message-scroller";
import * as React from "react";
import { View } from "react-native";

export interface Turn {
	readonly id: string;
	readonly question: string;
	readonly answer: string;
}

const TOPICS: readonly (readonly [string, string])[] = [
	["How do I invite a teammate?", "Open Settings › Members and tap Invite. They get an email with a link that works for 7 days."],
	["Can I change their role later?", "Yes. Tap their name in Members and pick Admin, Editor or Viewer; it applies at once."],
	["Where do I see last month's invoice?", "Billing › History lists every invoice; each opens as a PDF you can download."],
	["Why was my card declined?", "Usually the bank flagged the charge. Try again, or add another card under Billing › Payment."],
	["How do I export my data?", "Settings › Data › Export builds a ZIP of everything and emails you a link when it is ready."],
	["Is there a dark mode?", "Yes: it follows your phone's setting, or pick one under Settings › Appearance."],
	["Can I use it offline?", "Recent projects open offline; changes sync the next time you connect."],
	["How do I delete a project?", "Open the project, tap ⋯ › Delete. It stays in Trash for 30 days before it is gone."],
	["Who can see my comments?", "Everyone with access to the project. Private notes are only visible to you."],
];

/** The first `count` turns of the conversation (it repeats past the topics, numbered). */
export function sampleTurns(count: number, from = 0): readonly Turn[] {
	return Array.from({ length: count }, (_, offset: number): Turn => {
		const index = from + offset;
		const [question = "", answer = ""] = TOPICS.at(index % TOPICS.length) ?? [];
		return { id: `turn-${String(index + 1)}`, question, answer };
	});
}

/** One turn: the person's question, then the answer. */
export function TurnBubbles({ turn }: { readonly turn: Turn }): React.JSX.Element {
	return (
		<View className="gap-2">
			<Bubble text={turn.question} variant="sent" />
			<Bubble text={turn.answer} />
		</View>
	);
}

/** The scroller in a fixed-height card frame, its turns as items, with a jump to the latest message. */
export function TranscriptFrame({
	turns,
	anchors = false,
	children,
}: {
	readonly turns: readonly Turn[];
	readonly anchors?: boolean;
	readonly children?: React.ReactNode;
}): React.JSX.Element {
	return (
		<MessageScroller className="h-96 rounded-xl border border-border bg-card">
			<MessageScrollerViewport accessibilityLabel="Conversation" className="px-3">
				<MessageScrollerContent className="py-3">
					{children}
					{turns.map((turn: Turn): React.JSX.Element => (
						<MessageScrollerItem key={turn.id} messageId={turn.id} scrollAnchor={anchors}>
							<TurnBubbles turn={turn} />
						</MessageScrollerItem>
					))}
				</MessageScrollerContent>
			</MessageScrollerViewport>
			<MessageScrollerButton label="Scroll to latest message" />
		</MessageScroller>
	);
}
