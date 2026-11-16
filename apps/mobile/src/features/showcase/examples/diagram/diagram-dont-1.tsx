import { Diagram } from "@workspace/ui-native/components/diagram";
import * as React from "react";

const FLOW = `flowchart TD
  a[Password] --> b[Code] --> c[Signed in]`;

export function DiagramDont1Example(): React.JSX.Element {
	return <Diagram source={FLOW} />;
}
