import { MessageScrollerProvider } from "@workspace/ui-native/components/message-scroller";
import { SegmentedControl } from "@workspace/ui-native/components/segmented-control";
import type { MessageScrollerDefaultScrollPosition } from "@workspace/ui-native/lib/message-scroller";
import * as React from "react";
import { Text, View } from "react-native";

import { sampleTurns, TranscriptFrame } from "./message-scroller-sample";

const TURNS = sampleTurns(6);
const POSITIONS: readonly { readonly value: MessageScrollerDefaultScrollPosition; readonly label: string }[] = [
	{ value: "end", label: "Newest" },
	{ value: "last-anchor", label: "Last question" },
	{ value: "start", label: "Start" },
];

// Where a saved thread opens: at the newest message, with the last question at the top, or at the start (under a day divider).
export function MessageScroller4Example(): React.JSX.Element {
	const [position, setPosition] = React.useState<MessageScrollerDefaultScrollPosition>("end");
	return (
		<View className="w-full gap-3">
			<SegmentedControl label="Open at" options={POSITIONS} value={position} onChange={setPosition} />
			<MessageScrollerProvider key={position} defaultScrollPosition={position}>
				<TranscriptFrame turns={TURNS} anchors>
					<View className="flex-row items-center gap-2">
						<View className="h-px flex-1 bg-border" />
						<Text className="text-caption font-sans text-muted-foreground">Yesterday</Text>
						<View className="h-px flex-1 bg-border" />
					</View>
				</TranscriptFrame>
			</MessageScrollerProvider>
		</View>
	);
}
