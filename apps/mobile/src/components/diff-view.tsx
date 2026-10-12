// A unified diff, drawn the way GitHub draws one: two line-number gutters (the
// old file's, the new file's), the +/− marker, then the code in monospace —
// added lines on green, deleted on red, hunk headers on blue. Long lines
// scroll sideways instead of wrapping, so the code keeps its shape.
// Presentational and data-agnostic: the caller parses the patch into lines.

import * as React from "react";
import { ScrollView, Text, View } from "react-native";

/** What a line of a diff is: a hunk header, an unchanged line, an added or deleted one, or git's "\ No newline" note. */
export type DiffLineKind = "hunk" | "context" | "addition" | "deletion" | "note";

export interface DiffLine {
	/** Stable within one diff (built from the line numbers, never the position). */
	readonly key: string;
	readonly kind: DiffLineKind;
	/** The line's number in the file before the change; `null` for an added line, a hunk header or a note. */
	readonly oldNumber: number | null;
	/** Its number after the change; `null` for a deleted line, a hunk header or a note. */
	readonly newNumber: number | null;
	/** The code, without the diff marker (a hunk header is shown whole). */
	readonly text: string;
}

interface KindStyle {
	readonly row: string;
	readonly marker: string;
	readonly text: string;
	readonly markerText: string;
}

const KIND_STYLES: Readonly<Record<DiffLineKind, KindStyle>> = {
	hunk: { row: "bg-info-soft", marker: "", text: "text-info-foreground", markerText: "" },
	context: { row: "", marker: "text-muted-foreground", text: "text-foreground", markerText: " " },
	addition: { row: "bg-success-soft", marker: "text-success-foreground", text: "text-foreground", markerText: "+" },
	deletion: { row: "bg-destructive-soft", marker: "text-destructive-foreground", text: "text-foreground", markerText: "−" },
	note: { row: "", marker: "text-muted-foreground", text: "text-muted-foreground", markerText: "" },
};

/** Tabs are drawn as this many spaces: React Native gives a tab no fixed width. */
const TAB_AS_SPACES = "    ";
const TAB_PATTERN = /\t/g;

/** What a screen reader says for one line. */
function lineLabel(line: DiffLine): string {
	switch (line.kind) {
		case "hunk":
			return `Changes from ${line.text}`;
		case "addition":
			return `Added line ${String(line.newNumber ?? "")}: ${line.text}`;
		case "deletion":
			return `Deleted line ${String(line.oldNumber ?? "")}: ${line.text}`;
		case "context":
			return `Line ${String(line.newNumber ?? "")}: ${line.text}`;
		case "note":
			return line.text;
	}
}

export interface DiffViewProps {
	readonly lines: readonly DiffLine[];
	readonly testID?: string;
}

export function DiffView({ lines, testID }: DiffViewProps): React.JSX.Element {
	return (
		<ScrollView horizontal showsHorizontalScrollIndicator contentContainerClassName="min-w-full py-1" testID={testID}>
			{/* A column as wide as its widest line: every row's colour reaches the same edge. */}
			<View className="min-w-full">
				{lines.map((line: DiffLine): React.JSX.Element => (
					<DiffRow key={line.key} line={line} />
				))}
			</View>
		</ScrollView>
	);
}

interface DiffRowProps {
	readonly line: DiffLine;
}

const DiffRow = React.memo(function DiffRow({ line }: DiffRowProps): React.JSX.Element {
	const style = KIND_STYLES[line.kind];
	const text = line.text.replace(TAB_PATTERN, TAB_AS_SPACES);
	if (line.kind === "hunk" || line.kind === "note") {
		return (
			<View accessible accessibilityLabel={lineLabel(line)} className={`flex-row ${style.row}`}>
				<View className="w-20" />
				<Text className={`py-1 pr-4 font-mono text-xs ${style.text}`}>{text}</Text>
			</View>
		);
	}
	return (
		<View accessible accessibilityLabel={lineLabel(line)} className={`flex-row ${style.row}`}>
			<Gutter value={line.oldNumber} />
			<Gutter value={line.newNumber} />
			<Text className={`w-5 text-center font-mono text-xs leading-5 ${style.marker}`}>{style.markerText}</Text>
			<Text className={`pr-4 font-mono text-xs leading-5 ${style.text}`}>{text}</Text>
		</View>
	);
});

interface GutterProps {
	readonly value: number | null;
}

/** One line-number column; empty where the line does not exist on that side. */
function Gutter({ value }: GutterProps): React.JSX.Element {
	return <Text className="w-10 pr-2 text-right font-mono text-xs leading-5 text-muted-foreground">{value === null ? "" : String(value)}</Text>;
}
