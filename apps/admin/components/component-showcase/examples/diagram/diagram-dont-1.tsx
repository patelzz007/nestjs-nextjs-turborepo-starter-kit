import * as React from "react";
import { Diagram } from "@workspace/ui/components/diagram";

const FLOW = `flowchart LR
  pr[Pull request] --> review[Review] --> merge[Merge] --> deploy[Deploy]`;

export function DiagramDont1Example(): React.JSX.Element {
	return <Diagram source={FLOW} className="w-full max-w-md" />;
}
