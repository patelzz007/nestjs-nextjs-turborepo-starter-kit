import { Diagram } from "@workspace/ui-native/components/diagram";
import * as React from "react";

// Mermaid syntax, drawn by Pele and themed from the design tokens. `accTitle` names the diagram for a screen reader
// and `accDescr` says what a reader who cannot see it needs to know.
const RELEASE_FLOW = `flowchart LR
  accTitle: How a change reaches production
  accDescr: A pull request is reviewed, then merged, which deploys it to staging; once staging checks pass it is promoted to production.
  pr[Pull request] --> review{Review}
  review -->|approved| merge[Merge]
  review -->|changes requested| pr
  merge --> staging[Staging]
  staging --> prod[Production]`;

// A flowchart drawn from Mermaid text, fitted to the phone (a wide flow turns vertical), with a caption.
export function Diagram1Example(): React.JSX.Element {
	return <Diagram source={RELEASE_FLOW} caption="From pull request to production" className="w-full" />;
}
