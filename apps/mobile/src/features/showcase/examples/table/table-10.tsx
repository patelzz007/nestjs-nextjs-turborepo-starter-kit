import { Badge, type BadgeTone, type BadgeVariant } from "@workspace/ui-native/components/badge";
import { Button } from "@workspace/ui-native/components/button";
import { Table, type TableColumn, type TableRow } from "@workspace/ui-native/components/table";
import * as React from "react";
import { Text, View } from "react-native";

import { ignorePress } from "../example-support";

type Column = "service" | "plan" | "billing" | "status" | "actions";

interface Subscription {
	readonly service: string;
	readonly plan: string;
	readonly planTone: BadgeTone;
	readonly planVariant: BadgeVariant;
	readonly billing: string;
	readonly next: string;
	readonly status: string;
	readonly statusTone: BadgeTone;
}

const SUBSCRIPTIONS: readonly Subscription[] = [
	{ service: "Vercel Pro", plan: "Pro", planTone: "primary", planVariant: "solid", billing: "$20/mo", next: "Mar 1, 2025", status: "Active", statusTone: "success" },
	{
		service: "GitHub Enterprise",
		plan: "Enterprise",
		planTone: "info",
		planVariant: "solid",
		billing: "$21/user/mo",
		next: "Mar 15, 2025",
		status: "Active",
		statusTone: "success",
	},
	{
		service: "Figma Tenant",
		plan: "Tenant",
		planTone: "warning",
		planVariant: "light",
		billing: "$45/editor/mo",
		next: "Apr 1, 2025",
		status: "Active",
		statusTone: "success",
	},
	{
		service: "Slack Business+",
		plan: "Business+",
		planTone: "neutral",
		planVariant: "soft",
		billing: "$12.50/user/mo",
		next: "—",
		status: "Cancelled",
		statusTone: "destructive",
	},
	{
		service: "Linear Standard",
		plan: "Standard",
		planTone: "neutral",
		planVariant: "outline",
		billing: "$8/user/mo",
		next: "Mar 20, 2025",
		status: "Trial",
		statusTone: "info",
	},
];

const COLUMNS: readonly TableColumn<Column>[] = [
	{ key: "service", label: "Service" },
	{ key: "plan", label: "Plan" },
	{ key: "billing", label: "Billing", width: "md" },
	{ key: "status", label: "Status" },
	{ key: "actions", label: "Actions", align: "end", width: "md" },
];

const ROWS: readonly TableRow<Column>[] = SUBSCRIPTIONS.map((subscription: Subscription): TableRow<Column> => ({
	key: subscription.service,
	cells: { service: `${subscription.service}, next ${subscription.next}`, plan: subscription.plan, billing: subscription.billing, status: subscription.status, actions: "" },
	interactive: true,
	content: {
		service: (
			<View>
				<Text numberOfLines={1} className="text-label font-sans-medium text-foreground">
					{subscription.service}
				</Text>
				<Text className="text-caption font-sans text-muted-foreground">{`Next: ${subscription.next}`}</Text>
			</View>
		),
		plan: <Badge label={subscription.plan} tone={subscription.planTone} variant={subscription.planVariant} size="sm" />,
		status: <Badge label={subscription.status} tone={subscription.statusTone} variant="light" size="sm" />,
		actions: <Button label="Manage" variant="outline" size="xs" onPress={ignorePress} accessibilityLabel={`Manage ${subscription.service}`} className="self-end" />,
	},
}));

export function Table10Example(): React.JSX.Element {
	return <Table caption="Subscriptions" columns={COLUMNS} rows={ROWS} scrollable />;
}
