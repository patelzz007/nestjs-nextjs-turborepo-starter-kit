import * as React from "react";
import { Diagram } from "@workspace/ui/components/diagram";

const FLOW = `flowchart LR
  accTitle: Release flow
  accDescr: A pull request is reviewed, merged, then deployed to production.
  pr[Pull request] --> review[Review] --> merge[Merge] --> deploy[Deploy]`;

export function DiagramDo1Example(): React.JSX.Element {
	return <Diagram source={FLOW} caption="From pull request to production" className="w-full max-w-md" />;
}
