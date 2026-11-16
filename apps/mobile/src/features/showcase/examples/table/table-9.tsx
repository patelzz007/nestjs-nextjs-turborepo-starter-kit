import { Badge, type BadgeTone, type BadgeVariant } from "@workspace/ui-native/components/badge";
import { Frame, FramePanel } from "@workspace/ui-native/components/frame";
import { Table, type TableColumn, type TableRow } from "@workspace/ui-native/components/table";
import * as React from "react";
import { Text } from "react-native";

import { PersonCell } from "./table-sample";

type Column = "user" | "action" | "target" | "time";

interface Activity {
	readonly id: string;
	readonly user: string;
	readonly action: string;
	readonly target: string;
	readonly tone: BadgeTone;
	readonly variant: BadgeVariant;
	readonly time: string;
}

const ACTIVITIES: readonly Activity[] = [
	{ id: "activity-1", user: "Sarah Chen", action: "Deployed", target: "production", tone: "success", variant: "solid", time: "2 minutes ago" },
	{ id: "activity-2", user: "Marcus Johnson", action: "Merged", target: "feat/auth-flow", tone: "info", variant: "solid", time: "15 minutes ago" },
	{ id: "activity-3", user: "Emily Park", action: "Commented", target: "PR #284", tone: "neutral", variant: "outline", time: "1 hour ago" },
	{ id: "activity-4", user: "David Kim", action: "Reverted", target: "hotfix/api-crash", tone: "destructive", variant: "solid", time: "3 hours ago" },
	{ id: "activity-5", user: "Sofia Davis", action: "Created", target: "issue #512", tone: "neutral", variant: "soft", time: "5 hours ago" },
];

const COLUMNS: readonly TableColumn<Column>[] = [
	{ key: "user", label: "User" },
	{ key: "action", label: "Action" },
	{ key: "target", label: "Target", width: "lg" },
	{ key: "time", label: "Time", align: "end", width: "md" },
];

const ROWS: readonly TableRow<Column>[] = ACTIVITIES.map((activity: Activity): TableRow<Column> => ({
	key: activity.id,
	cells: { user: activity.user, action: activity.action, target: activity.target, time: activity.time },
	content: {
		user: <PersonCell name={activity.user} line={activity.time} />,
		action: <Badge label={activity.action} tone={activity.tone} variant={activity.variant} size="sm" />,
		target: <Text className="text-caption font-code text-foreground">{activity.target}</Text>,
	},
}));

export function Table9Example(): React.JSX.Element {
	return (
		<Frame spacing="xs">
			<FramePanel className="p-1">
				<Table caption="Activity log" columns={COLUMNS} rows={ROWS} variant="plain" scrollable />
			</FramePanel>
		</Frame>
	);
}
