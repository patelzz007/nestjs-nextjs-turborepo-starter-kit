import { Diagram } from "@workspace/ui-native/components/diagram";
import * as React from "react";

const FLOW = `flowchart TD
  accTitle: Sign-in
  accDescr: The app asks for a password, then a code; a correct code signs you in.
  a[Password] --> b[Code] --> c[Signed in]`;

export function DiagramDo1Example(): React.JSX.Element {
	return <Diagram source={FLOW} />;
}
