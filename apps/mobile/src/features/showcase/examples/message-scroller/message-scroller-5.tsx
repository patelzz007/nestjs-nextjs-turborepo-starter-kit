import { Badge } from "@workspace/ui-native/components/badge";
import { Button } from "@workspace/ui-native/components/button";
import { MessageScrollerProvider, useMessageScrollerScrollable } from "@workspace/ui-native/components/message-scroller";
import * as React from "react";
import { View } from "react-native";

import { sampleTurns, TranscriptFrame } from "./message-scroller-sample";

const TOTAL = 16;
const WINDOW = 6;
const PAGE = 5;

function ScrollBadge(): React.JSX.Element {
	const { start } = useMessageScrollerScrollable();
	return <Badge label={start ? "Can scroll up" : "At the top"} tone={start ? "info" : "neutral"} variant="light" size="sm" />;
}

// Load earlier: five older turns per press join the top of a six-of-sixteen window, and the reader keeps their place.
export function MessageScroller5Example(): React.JSX.Element {
	const [first, setFirst] = React.useState(TOTAL - WINDOW);
	const turns = React.useMemo(() => sampleTurns(TOTAL - first, first), [first]);
	const loadEarlier = React.useCallback((): void => {
		setFirst((current: number): number => Math.max(0, current - PAGE));
	}, []);
	return (
		<MessageScrollerProvider>
			<View className="w-full gap-2">
				<View className="flex-row items-center justify-between">
					<Button label={first === 0 ? "All loaded" : "Load earlier"} variant="outline" size="xs" onPress={loadEarlier} disabled={first === 0} />
					<ScrollBadge />
				</View>
				<TranscriptFrame turns={turns} />
			</View>
		</MessageScrollerProvider>
	);
}
