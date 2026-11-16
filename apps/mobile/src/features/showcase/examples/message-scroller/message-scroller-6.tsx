import { IconButton } from "@workspace/ui-native/components/icon-button";
import { MessageScrollerProvider, useMessageScroller, useMessageScrollerVisibility } from "@workspace/ui-native/components/message-scroller";
import ChevronDownIcon from "lucide-react-native/icons/chevron-down";
import ChevronUpIcon from "lucide-react-native/icons/chevron-up";
import * as React from "react";
import { Text, View } from "react-native";

import { sampleTurns, TranscriptFrame } from "./message-scroller-sample";

const TURNS = sampleTurns(7);

/** Previous and next around a turn counter and the current question, tracked from the scroller's anchor. */
function Navigator(): React.JSX.Element {
	const { currentAnchorId } = useMessageScrollerVisibility();
	const { scrollToMessage } = useMessageScroller();
	const position = Math.max(
		0,
		TURNS.findIndex((turn): boolean => turn.id === currentAnchorId),
	);
	const turn = TURNS.at(position);
	const previous = React.useCallback((): void => {
		const target = TURNS.at(position - 1);
		if (target !== undefined) {
			scrollToMessage(target.id);
		}
	}, [position, scrollToMessage]);
	const next = React.useCallback((): void => {
		const target = TURNS.at(position + 1);
		if (target !== undefined) {
			scrollToMessage(target.id);
		}
	}, [position, scrollToMessage]);
	return (
		<View className="flex-row items-center gap-2 rounded-lg border border-border px-2 py-1">
			<IconButton icon={ChevronUpIcon} label="Previous question" onPress={previous} disabled={position === 0} variant="ghost" size="sm" />
			<View className="flex-1" accessibilityLiveRegion="polite">
				<Text className="text-caption font-sans text-muted-foreground">{`Question ${String(position + 1)} of ${String(TURNS.length)}`}</Text>
				<Text numberOfLines={1} className="text-label font-sans-medium text-foreground">
					{turn?.question}
				</Text>
			</View>
			<IconButton icon={ChevronDownIcon} label="Next question" onPress={next} disabled={position === TURNS.length - 1} variant="ghost" size="sm" />
		</View>
	);
}

// A navigator that steps from question to question: it follows the turn the reader is in, and jumps to the one asked for.
export function MessageScroller6Example(): React.JSX.Element {
	return (
		<MessageScrollerProvider defaultScrollPosition="start">
			<View className="w-full gap-2">
				<Navigator />
				<TranscriptFrame turns={TURNS} anchors />
			</View>
		</MessageScrollerProvider>
	);
}
