import * as React from "react";
import { GuidelineTree, type GuidelineTreeRow } from "@/components/component-showcase/examples/tree/tree-guideline-sample";

const ROWS: Readonly<Record<string, GuidelineTreeRow>> = {
	root: { name: "Workspace", children: ["projects", "billing"] },
	projects: { name: "Projects", children: ["website", "mobile"] },
	website: { name: "Website relaunch" },
	mobile: { name: "Mobile app" },
	billing: { name: "Billing", children: ["invoices"] },
	invoices: { name: "Invoices" },
};

export function TreeDo1Example(): React.JSX.Element {
	return <GuidelineTree rows={ROWS} rootId="root" label="Workspace" />;
}
