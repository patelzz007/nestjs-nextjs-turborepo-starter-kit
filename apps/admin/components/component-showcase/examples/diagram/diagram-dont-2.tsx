import * as React from "react";
import { Diagram } from "@workspace/ui/components/diagram";

const FLOW = `flowchart LR
  accTitle: Everything
  accDescr: Every service and queue in the platform.
  web --> gateway --> auth --> users --> db1[(Users DB)]
  gateway --> orders --> payments --> ledger --> db2[(Ledger DB)]
  orders --> inventory --> warehouse --> shipping --> carriers
  payments --> fraud --> reviews --> notify --> email & sms & push
  gateway --> search --> index --> crawler --> storage --> cdn`;

export function DiagramDont2Example(): React.JSX.Element {
	return <Diagram source={FLOW} className="w-full max-w-md" />;
}
