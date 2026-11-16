import * as React from "react";
import { Diagram } from "@workspace/ui/components/diagram";

const FLOW = `flowchart LR
  accTitle: Release flow
  accDescr: Build, test, stage and ship.
  build[Build] --> test[Test] --> stage[Stage] --> ship[Ship]`;

export function DiagramDo2Example(): React.JSX.Element {
	return <Diagram source={FLOW} caption="The four stages of a release" className="w-full max-w-md" />;
}
