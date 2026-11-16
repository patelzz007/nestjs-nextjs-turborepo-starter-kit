import * as React from "react";
import { GuidelineTranscript } from "@/components/component-showcase/examples/message-scroller/message-scroller-guideline-sample";

export function MessageScrollerDo1Example(): React.JSX.Element {
	return <GuidelineTranscript opensAt="end" forceFollow={false} />;
}
