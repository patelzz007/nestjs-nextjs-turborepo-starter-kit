import * as React from "react";
import { GuidelineTree, type GuidelineTreeRow } from "@/components/component-showcase/examples/tree/tree-guideline-sample";

const ROWS: Readonly<Record<string, GuidelineTreeRow>> = {
	root: { name: "Permissions", children: ["invoices", "members"] },
	invoices: { name: "Invoices", children: ["invoices-read", "invoices-write"] },
	"invoices-read": { name: "Read invoices" },
	"invoices-write": { name: "Create and edit invoices" },
	members: { name: "Members", children: ["members-invite"] },
	"members-invite": { name: "Invite members" },
};

export function TreeDo2Example(): React.JSX.Element {
	return (
		<div className="flex flex-col gap-2">
			<h4 className="text-sm font-semibold">Role permissions</h4>
			<GuidelineTree rows={ROWS} rootId="root" label="Role permissions" />
		</div>
	);
}
