import { Diagram } from "@workspace/ui-native/components/diagram";
import * as React from "react";

const FLOW = `flowchart TD
  accTitle: Refund
  accDescr: A refund is requested, approved, then paid.
  a[Requested] --> b[Approved] --> c[Paid]`;

export function DiagramDo2Example(): React.JSX.Element {
	return <Diagram source={FLOW} />;
}
