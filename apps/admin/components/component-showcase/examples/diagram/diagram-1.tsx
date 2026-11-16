import type * as React from "react";
import { Diagram } from "@workspace/ui/components/diagram";

// Mermaid syntax, drawn by Pele and themed from the design tokens. `accTitle` names the diagram for a
// screen reader and `accDescr` says what a reader who cannot see it needs to know.
const RELEASE_FLOW = `flowchart LR
  accTitle: How a change reaches production
  accDescr: A pull request is reviewed, then merged, which deploys it to staging; once staging checks pass it is promoted to production.
  pr[Pull request] --> review{Review}
  review -->|approved| merge[Merge]
  review -->|changes requested| pr
  merge --> staging[Staging]
  staging --> prod[Production]`;

export function Diagram1Example(): React.JSX.Element {
	return <Diagram source={RELEASE_FLOW} caption="From pull request to production" className="w-full max-w-2xl" />;
}
