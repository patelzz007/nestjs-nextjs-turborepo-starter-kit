import { Diagram } from "@workspace/ui-native/components/diagram";
import * as React from "react";

const FLOW = `flowchart LR
  accTitle: Every refund path
  accDescr: Twelve states with many branches.
  a[Requested] --> b[Triage] --> c[Review] --> d[Approved] --> e[Queued] --> f[Paid]
  b --> g[Fraud check] --> h[Escalated] --> i[Manager] --> d
  c --> j[Needs info] --> k[Customer replied] --> c
  i --> l[Declined]`;

export function DiagramDont2Example(): React.JSX.Element {
	return <Diagram source={FLOW} />;
}
