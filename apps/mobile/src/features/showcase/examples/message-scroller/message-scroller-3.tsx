import { Bubble } from "@workspace/ui-native/components/bubble";
import { IconButton } from "@workspace/ui-native/components/icon-button";
import { Input } from "@workspace/ui-native/components/input";
import {
	MessageScroller,
	MessageScrollerButton,
	MessageScrollerContent,
	MessageScrollerItem,
	MessageScrollerProvider,
	MessageScrollerViewport,
} from "@workspace/ui-native/components/message-scroller";
import SendIcon from "lucide-react-native/icons/send";
import * as React from "react";
import { View } from "react-native";

import { sampleTurns, TurnBubbles, type Turn } from "./message-scroller-sample";

const START = sampleTurns(3);
const CANNED = "Good question — I've noted it for the team, and here is what I can tell you now: most settings live under Settings, and changes apply at once.";
const ANSWER_MS = 900;
const PEEK = 64;

// Each question sent is lifted near the top under a 64-point peek of the turn before; a canned answer follows.
export function MessageScroller3Example(): React.JSX.Element {
	const [turns, setTurns] = React.useState<readonly Turn[]>(START);
	const [draft, setDraft] = React.useState("");
	const send = React.useCallback((): void => {
		const question = draft.trim();
		if (question === "") {
			return;
		}
		const id = `sent-${String(Date.now())}`;
		setTurns((current) => [...current, { id, question, answer: "" }]);
		setDraft("");
		setTimeout((): void => {
			setTurns((current) => current.map((turn: Turn): Turn => (turn.id === id ? { ...turn, answer: CANNED } : turn)));
		}, ANSWER_MS);
	}, [draft]);
	return (
		<View className="w-full gap-2">
			<MessageScrollerProvider scrollPreviousItemPeek={PEEK}>
				<MessageScroller className="h-96 rounded-xl border border-border bg-card">
					<MessageScrollerViewport accessibilityLabel="Conversation" className="px-3">
						<MessageScrollerContent className="py-3">
							{turns.map((turn: Turn): React.JSX.Element => (
								<MessageScrollerItem key={turn.id} messageId={turn.id} scrollAnchor>
									{turn.answer === "" ? <Bubble text={turn.question} variant="sent" /> : <TurnBubbles turn={turn} />}
								</MessageScrollerItem>
							))}
						</MessageScrollerContent>
					</MessageScrollerViewport>
					<MessageScrollerButton label="Scroll to latest message" />
				</MessageScroller>
			</MessageScrollerProvider>
			<View className="flex-row items-center gap-2">
				<View className="flex-1">
					<Input value={draft} onChange={setDraft} placeholder="Ask a question" accessibilityLabel="Question" onSubmitEditing={send} returnKeyType="send" />
				</View>
				<IconButton icon={SendIcon} label="Send" onPress={send} disabled={draft.trim() === ""} />
			</View>
		</View>
	);
}
