import { Badge, type BadgeTone, type BadgeVariant } from "@workspace/ui-native/components/badge";
import { Table, type TableColumn, type TableRow } from "@workspace/ui-native/components/table";
import * as React from "react";
import { Text } from "react-native";

import { PersonCell } from "./table-sample";

type Column = "rank" | "player" | "level" | "score" | "change";

interface Leader {
	readonly rank: number;
	readonly name: string;
	readonly handle: string;
	readonly score: number;
	readonly change: string;
	readonly up: boolean;
	readonly level: string;
	readonly tone: BadgeTone;
	readonly variant: BadgeVariant;
}

const LEADERS: readonly Leader[] = [
	{ rank: 1, name: "Sarah Chen", handle: "@sarahchen", score: 12_840, change: "+320", up: true, level: "Diamond", tone: "info", variant: "solid" },
	{ rank: 2, name: "Marcus Johnson", handle: "@marcusj", score: 11_250, change: "+180", up: true, level: "Platinum", tone: "primary", variant: "solid" },
	{ rank: 3, name: "Emily Park", handle: "@emilyp", score: 10_890, change: "-45", up: false, level: "Platinum", tone: "primary", variant: "solid" },
	{ rank: 4, name: "David Kim", handle: "@davidk", score: 9_420, change: "+520", up: true, level: "Gold", tone: "warning", variant: "solid" },
	{ rank: 5, name: "Sofia Davis", handle: "@sofiad", score: 8_750, change: "+90", up: true, level: "Gold", tone: "warning", variant: "solid" },
];

const SCORE = new Intl.NumberFormat("en-US");

const COLUMNS: readonly TableColumn<Column>[] = [
	{ key: "rank", label: "#", width: "xs" },
	{ key: "player", label: "Player", width: "lg" },
	{ key: "level", label: "Level" },
	{ key: "score", label: "Score", align: "end" },
	{ key: "change", label: "Change", align: "end", width: "xs" },
];

const ROWS: readonly TableRow<Column>[] = LEADERS.map((leader: Leader): TableRow<Column> => ({
	key: String(leader.rank),
	cells: { rank: String(leader.rank), player: `${leader.name}, ${leader.handle}`, level: leader.level, score: SCORE.format(leader.score), change: leader.change },
	content: {
		player: <PersonCell name={leader.name} line={leader.handle} />,
		level: <Badge label={leader.level} tone={leader.tone} variant={leader.variant} size="sm" />,
		change: (
			<Text
				className={
					leader.up
						? "text-caption font-sans-medium text-right text-success-foreground tabular-nums"
						: "text-caption font-sans-medium text-right text-destructive-foreground tabular-nums"
				}>
				{leader.change}
			</Text>
		),
	},
}));

export function Table15Example(): React.JSX.Element {
	return <Table caption="Leaderboard" columns={COLUMNS} rows={ROWS} scrollable />;
}
