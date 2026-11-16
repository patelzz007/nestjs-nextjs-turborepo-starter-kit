import { MessageScrollerProvider } from "@workspace/ui-native/components/message-scroller";
import * as React from "react";

import { sampleTurns, TranscriptFrame } from "./message-scroller-sample";

const TURNS = sampleTurns(8);

/** Keeping its place switched off: older messages arriving above shove the reader along. */
export function MessageScrollerDont2Example(): React.JSX.Element {
	return (
		<MessageScrollerProvider preserveScrollOnPrepend={false}>
			<TranscriptFrame turns={TURNS} />
		</MessageScrollerProvider>
	);
}
