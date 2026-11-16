import { Badge, type BadgeTone } from "@workspace/ui-native/components/badge";
import { Card } from "@workspace/ui-native/components/card";
import { Table, type TableColumn, type TableRow } from "@workspace/ui-native/components/table";
import * as React from "react";

type Column = "task" | "status";

interface Task {
	readonly id: string;
	readonly name: string;
	readonly status: string;
	readonly tone: BadgeTone;
}

const TASKS: readonly Task[] = [
	{ id: "1", name: "Design homepage", status: "Completed", tone: "success" },
	{ id: "2", name: "Implement API", status: "In Progress", tone: "warning" },
	{ id: "3", name: "Write tests", status: "Pending", tone: "neutral" },
];

const COLUMNS: readonly TableColumn<Column>[] = [
	{ key: "task", label: "Task" },
	{ key: "status", label: "Status", align: "end", width: "md" },
];

const ROWS: readonly TableRow<Column>[] = TASKS.map((task: Task): TableRow<Column> => ({
	key: task.id,
	cells: { task: task.name, status: task.status },
	content: { status: <Badge label={task.status} tone={task.tone} variant="soft" size="sm" className="self-end" /> },
}));

export function Table3Example(): React.JSX.Element {
	return (
		<Card className="p-2">
			<Table caption="Tasks" columns={COLUMNS} rows={ROWS} variant="plain" />
		</Card>
	);
}
