import { Avatar } from "@workspace/ui-native/components/avatar";
import { Badge, type BadgeTone, type BadgeVariant } from "@workspace/ui-native/components/badge";
import type { LucideIcon } from "@workspace/ui-native/components/icon";
import { Table, type TableColumn, type TableRow } from "@workspace/ui-native/components/table";
import ArrowDownIcon from "lucide-react-native/icons/arrow-down";
import ArrowRightIcon from "lucide-react-native/icons/arrow-right";
import ArrowUpIcon from "lucide-react-native/icons/arrow-up";
import * as React from "react";
import { Text, View } from "react-native";

import { PORTRAITS } from "./table-sample";

type Column = "id" | "title" | "priority" | "assignee" | "status";

interface Issue {
	readonly id: string;
	readonly title: string;
	readonly priority: string;
	readonly priorityTone: BadgeTone;
	readonly priorityVariant: BadgeVariant;
	readonly priorityIcon: LucideIcon;
	readonly label: string;
	readonly labelTone: BadgeTone;
	readonly labelVariant: BadgeVariant;
	readonly assignee: string;
	readonly status: string;
	readonly statusTone: BadgeTone;
}

const ISSUES: readonly Issue[] = [
	{
		id: "ISS-421",
		title: "Login page returns 500 on mobile",
		priority: "Critical",
		priorityTone: "destructive",
		priorityVariant: "solid",
		priorityIcon: ArrowUpIcon,
		label: "Bug",
		labelTone: "destructive",
		labelVariant: "light",
		assignee: "Sarah Chen",
		status: "Open",
		statusTone: "info",
	},
	{
		id: "ISS-420",
		title: "Add dark mode support",
		priority: "High",
		priorityTone: "warning",
		priorityVariant: "solid",
		priorityIcon: ArrowUpIcon,
		label: "Feature",
		labelTone: "info",
		labelVariant: "light",
		assignee: "Marcus Johnson",
		status: "In Progress",
		statusTone: "warning",
	},
	{
		id: "ISS-419",
		title: "Update user onboarding flow",
		priority: "Medium",
		priorityTone: "info",
		priorityVariant: "solid",
		priorityIcon: ArrowRightIcon,
		label: "Improvement",
		labelTone: "success",
		labelVariant: "light",
		assignee: "Emily Park",
		status: "In Review",
		statusTone: "info",
	},
	{
		id: "ISS-418",
		title: "Refactor API rate limiter module",
		priority: "Low",
		priorityTone: "neutral",
		priorityVariant: "soft",
		priorityIcon: ArrowDownIcon,
		label: "Tech Debt",
		labelTone: "neutral",
		labelVariant: "outline",
		assignee: "David Kim",
		status: "Closed",
		statusTone: "success",
	},
];

const COLUMNS: readonly TableColumn<Column>[] = [
	{ key: "id", label: "ID", width: "sm" },
	{ key: "title", label: "Title", width: "lg" },
	{ key: "priority", label: "Priority" },
	{ key: "assignee", label: "Assignee", width: "md" },
	{ key: "status", label: "Status" },
];

const ROWS: readonly TableRow<Column>[] = ISSUES.map((issue: Issue): TableRow<Column> => ({
	key: issue.id,
	cells: { id: issue.id, title: `${issue.title}, ${issue.label}`, priority: issue.priority, assignee: issue.assignee, status: issue.status },
	content: {
		id: <Text className="text-caption font-code text-muted-foreground">{issue.id}</Text>,
		title: (
			<View className="gap-1">
				<Text numberOfLines={1} className="text-label font-sans-medium text-foreground">
					{issue.title}
				</Text>
				<Badge label={issue.label} tone={issue.labelTone} variant={issue.labelVariant} size="sm" />
			</View>
		),
		priority: <Badge label={issue.priority} tone={issue.priorityTone} variant={issue.priorityVariant} icon={issue.priorityIcon} size="sm" />,
		assignee: (
			<View className="flex-row items-center gap-2">
				<Avatar name={issue.assignee} imageUrl={PORTRAITS[issue.assignee] ?? null} size="sm" />
				<Text numberOfLines={1} className="text-caption shrink font-sans text-foreground">
					{issue.assignee}
				</Text>
			</View>
		),
		status: <Badge label={issue.status} tone={issue.statusTone} variant="light" size="sm" />,
	},
}));

export function Table14Example(): React.JSX.Element {
	return <Table caption="Issues" columns={COLUMNS} rows={ROWS} scrollable />;
}
