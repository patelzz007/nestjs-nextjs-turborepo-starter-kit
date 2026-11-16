import { Avatar } from "@workspace/ui-native/components/avatar";
import { Badge, type BadgeTone, type BadgeVariant } from "@workspace/ui-native/components/badge";
import { IconTile } from "@workspace/ui-native/components/icon-tile";
import { Table, type TableColumn, type TableRow } from "@workspace/ui-native/components/table";
import FolderIcon from "lucide-react-native/icons/folder";
import * as React from "react";
import { Text, View } from "react-native";

import { PORTRAITS } from "./table-sample";

type Column = "project" | "status" | "team" | "due";

interface Project {
	readonly name: string;
	readonly description: string;
	readonly status: string;
	readonly tone: BadgeTone;
	readonly variant: BadgeVariant;
	readonly team: readonly string[];
	readonly extra: number;
	readonly due: string;
}

const PROJECTS: readonly Project[] = [
	{
		name: "Website Redesign",
		description: "Landing page and marketing site",
		status: "In Progress",
		tone: "info",
		variant: "light",
		team: ["Sarah Chen", "Marcus Johnson", "Emily Park"],
		extra: 2,
		due: "Mar 15",
	},
	{
		name: "Mobile App v2",
		description: "iOS and Android release",
		status: "Review",
		tone: "warning",
		variant: "light",
		team: ["David Kim", "Sofia Davis"],
		extra: 0,
		due: "Apr 1",
	},
	{
		name: "API Integration",
		description: "Third-party payment gateway",
		status: "Completed",
		tone: "success",
		variant: "light",
		team: ["Marcus Johnson"],
		extra: 0,
		due: "Feb 28",
	},
	{
		name: "Analytics Dashboard",
		description: "Real-time metrics and reporting",
		status: "Planning",
		tone: "neutral",
		variant: "outline",
		team: ["Emily Park", "Sarah Chen"],
		extra: 1,
		due: "May 10",
	},
];

const COLUMNS: readonly TableColumn<Column>[] = [
	{ key: "project", label: "Project" },
	{ key: "status", label: "Status", width: "md" },
	{ key: "team", label: "Team", width: "md" },
	{ key: "due", label: "Due", align: "end", width: "xs" },
];

function Team({ project }: { readonly project: Project }): React.JSX.Element {
	return (
		<View className="flex-row items-center">
			{project.team.map((name: string, position: number): React.JSX.Element => (
				<Avatar
					key={name}
					name={name}
					imageUrl={PORTRAITS[name] ?? null}
					size="sm"
					className={position === 0 ? "border-2 border-background" : "-ml-2 border-2 border-background"}
				/>
			))}
			{project.extra > 0 ? (
				<View className="-ml-2 size-6 items-center justify-center rounded-full border-2 border-background bg-muted">
					<Text className="text-overline font-sans-medium text-muted-foreground">{`+${String(project.extra)}`}</Text>
				</View>
			) : null}
		</View>
	);
}

const ROWS: readonly TableRow<Column>[] = PROJECTS.map((project: Project): TableRow<Column> => ({
	key: project.name,
	cells: {
		project: `${project.name}, ${project.description}`,
		status: project.status,
		team: `${project.team.join(", ")}${project.extra > 0 ? ` and ${String(project.extra)} more` : ""}`,
		due: project.due,
	},
	content: {
		project: (
			<View className="flex-row items-center gap-3">
				<IconTile icon={FolderIcon} size="sm" />
				<View className="shrink">
					<Text numberOfLines={1} className="text-label font-sans-medium text-foreground">
						{project.name}
					</Text>
					<Text numberOfLines={1} className="text-caption font-sans text-muted-foreground">
						{project.description}
					</Text>
				</View>
			</View>
		),
		status: <Badge label={project.status} tone={project.tone} variant={project.variant} size="sm" />,
		team: <Team project={project} />,
	},
}));

export function Table8Example(): React.JSX.Element {
	return <Table caption="Projects" columns={COLUMNS} rows={ROWS} scrollable />;
}
