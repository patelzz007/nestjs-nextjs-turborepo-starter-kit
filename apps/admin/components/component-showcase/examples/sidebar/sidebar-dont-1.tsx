import * as React from "react";
import { GuidelineSidebar, type GuidelineSidebarGroup } from "@/components/component-showcase/examples/sidebar/sidebar-guideline-sample";

const GROUPS: readonly GuidelineSidebarGroup[] = [
	{
		items: [
			"Home",
			"Inbox",
			"Projects",
			"Tasks",
			"Calendar",
			"Documents",
			"Invoices",
			"Payments",
			"Reports",
			"Customers",
			"Products",
			"Orders",
			"Members",
			"Roles",
			"Billing",
			"Integrations",
			"Webhooks",
			"Audit log",
		],
	},
];

export function SidebarDont1Example(): React.JSX.Element {
	return <GuidelineSidebar groups={GROUPS} searchable={false} />;
}
