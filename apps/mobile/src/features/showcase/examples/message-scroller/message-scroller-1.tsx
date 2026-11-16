import { MessageScrollerProvider } from "@workspace/ui-native/components/message-scroller";
import * as React from "react";

import { sampleTurns, TranscriptFrame } from "./message-scroller-sample";

const TURNS = sampleTurns(9);

// A read-only thread on the defaults: it opens at the newest message, and a button jumps back down after scrolling up.
export function MessageScroller1Example(): React.JSX.Element {
	return (
		<MessageScrollerProvider>
			<TranscriptFrame turns={TURNS} />
		</MessageScrollerProvider>
	);
}
