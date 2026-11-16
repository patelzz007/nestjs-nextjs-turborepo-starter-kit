import { Badge } from "@workspace/ui-native/components/badge";
import { Bubble } from "@workspace/ui-native/components/bubble";
import { Button } from "@workspace/ui-native/components/button";
import {
	MessageScroller,
	MessageScrollerButton,
	MessageScrollerContent,
	MessageScrollerItem,
	MessageScrollerProvider,
	MessageScrollerViewport,
} from "@workspace/ui-native/components/message-scroller";
import * as React from "react";
import { View } from "react-native";

import { sampleTurns, TurnBubbles } from "./message-scroller-sample";

const HISTORY = sampleTurns(4);
const REPLY =
	"To move a project to another workspace, open it, tap ⋯ › Move, and pick the workspace. Members who are not in the new workspace lose access, comments and history move with it, and links keep working because they redirect to the new address.";
/** Characters revealed per tick, and the tick, as on the web. */
const STEP = 4;
const TICK_MS = 28;

// A reply typed out while the transcript follows its growing edge, under a Working badge; Replay streams it again.
export function MessageScroller2Example(): React.JSX.Element {
	const [shown, setShown] = React.useState(0);
	const [run, setRun] = React.useState(0);
	React.useEffect((): (() => void) => {
		const timer = setInterval((): void => {
			setShown((current: number): number => Math.min(REPLY.length, current + STEP));
		}, TICK_MS);
		return (): void => {
			clearInterval(timer);
		};
	}, [run]);
	const replay = React.useCallback((): void => {
		setShown(0);
		setRun((current: number): number => current + 1);
	}, []);
	const working = shown < REPLY.length;
	return (
		<View className="w-full gap-2">
			<View className="flex-row items-center justify-between">
				{working ? <Badge label="Working" tone="info" variant="light" size="sm" /> : <Badge label="Done" tone="success" variant="light" size="sm" />}
				<Button label="Replay stream" variant="outline" size="xs" onPress={replay} disabled={working} />
			</View>
			<MessageScrollerProvider>
				<MessageScroller className="h-96 rounded-xl border border-border bg-card">
					<MessageScrollerViewport accessibilityLabel="Conversation" className="px-3">
						<MessageScrollerContent className="py-3">
							{HISTORY.map((turn): React.JSX.Element => (
								<MessageScrollerItem key={turn.id} messageId={turn.id}>
									<TurnBubbles turn={turn} />
								</MessageScrollerItem>
							))}
							<MessageScrollerItem messageId="question">
								<Bubble text="How do I move a project to another workspace?" variant="sent" />
							</MessageScrollerItem>
							<MessageScrollerItem messageId="reply">
								<Bubble text={`${REPLY.slice(0, shown)}${working ? "▍" : ""}`} accessibilityLabel={working ? "Writing a reply" : REPLY} />
							</MessageScrollerItem>
						</MessageScrollerContent>
					</MessageScrollerViewport>
					<MessageScrollerButton label="Scroll to latest message" />
				</MessageScroller>
			</MessageScrollerProvider>
		</View>
	);
}
