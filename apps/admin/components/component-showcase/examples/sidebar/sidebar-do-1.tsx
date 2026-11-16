import * as React from "react";
import { GuidelineSidebar, type GuidelineSidebarGroup } from "@/components/component-showcase/examples/sidebar/sidebar-guideline-sample";

const GROUPS: readonly GuidelineSidebarGroup[] = [
	{ label: "Workspace", items: ["Home", "Inbox", "Projects"] },
	{ label: "Finance", items: ["Invoices", "Payments", "Reports"] },
	{ label: "Settings", items: ["Members", "Billing"] },
];

export function SidebarDo1Example(): React.JSX.Element {
	return <GuidelineSidebar groups={GROUPS} searchable />;
}
