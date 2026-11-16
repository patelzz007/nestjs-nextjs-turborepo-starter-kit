import { MessageScrollerProvider } from "@workspace/ui-native/components/message-scroller";
import * as React from "react";

import { sampleTurns, TranscriptFrame } from "./message-scroller-sample";

const TURNS = sampleTurns(8);

export function MessageScrollerDont1Example(): React.JSX.Element {
	return (
		<MessageScrollerProvider defaultScrollPosition="start">
			<TranscriptFrame turns={TURNS} />
		</MessageScrollerProvider>
	);
}
