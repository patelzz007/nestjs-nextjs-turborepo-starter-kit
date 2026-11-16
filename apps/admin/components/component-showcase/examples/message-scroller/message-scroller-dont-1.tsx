import * as React from "react";
import { GuidelineTranscript } from "@/components/component-showcase/examples/message-scroller/message-scroller-guideline-sample";

export function MessageScrollerDont1Example(): React.JSX.Element {
	return <GuidelineTranscript opensAt="start" forceFollow={false} />;
}
