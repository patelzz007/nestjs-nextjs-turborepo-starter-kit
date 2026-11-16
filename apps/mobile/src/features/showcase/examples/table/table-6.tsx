import { Badge, type BadgeTone, type BadgeVariant } from "@workspace/ui-native/components/badge";
import { Frame, FramePanel } from "@workspace/ui-native/components/frame";
import { Table, type TableColumn, type TableRow } from "@workspace/ui-native/components/table";
import * as React from "react";

import { PersonCell } from "./table-sample";

type Column = "member" | "role" | "status";

interface Member {
	readonly name: string;
	readonly email: string;
	readonly role: string;
	readonly roleTone: BadgeTone;
	readonly roleVariant: BadgeVariant;
	readonly status: string;
	readonly statusTone: BadgeTone;
}

const MEMBERS: readonly Member[] = [
	{ name: "Sarah Chen", email: "sarah@example.com", role: "Admin", roleTone: "primary", roleVariant: "solid", status: "Active", statusTone: "success" },
	{ name: "Marcus Johnson", email: "marcus@example.com", role: "Developer", roleTone: "info", roleVariant: "light", status: "Active", statusTone: "success" },
	{ name: "Emily Park", email: "emily@example.com", role: "Designer", roleTone: "warning", roleVariant: "light", status: "Away", statusTone: "warning" },
	{ name: "David Kim", email: "david@example.com", role: "Viewer", roleTone: "neutral", roleVariant: "outline", status: "Offline", statusTone: "neutral" },
];

const COLUMNS: readonly TableColumn<Column>[] = [
	{ key: "member", label: "Member" },
	{ key: "role", label: "Role", width: "md" },
	{ key: "status", label: "Status" },
];

const ROWS: readonly TableRow<Column>[] = MEMBERS.map((member: Member): TableRow<Column> => ({
	key: member.email,
	cells: { member: `${member.name}, ${member.email}`, role: member.role, status: member.status },
	content: {
		member: <PersonCell name={member.name} line={member.email} />,
		role: <Badge label={member.role} tone={member.roleTone} variant={member.roleVariant} size="sm" />,
		status: <Badge label={member.status} tone={member.statusTone} variant={member.statusTone === "neutral" ? "outline" : "light"} size="sm" />,
	},
}));

export function Table6Example(): React.JSX.Element {
	return (
		<Frame spacing="xs">
			<FramePanel className="p-1">
				<Table caption="Team members" columns={COLUMNS} rows={ROWS} variant="plain" scrollable />
			</FramePanel>
		</Frame>
	);
}
