import { Cascader, type CascaderItemState } from "@workspace/ui-native/components/cascader";
import { cn } from "@workspace/ui-native/lib/cn";
import type { CascaderNode } from "@workspace/ui-native/lib/cascader";
import * as React from "react";
import { Text, View } from "react-native";

const DOTS: Readonly<Record<string, string>> = {
	"status.todo": "bg-muted-foreground",
	"status.doing": "bg-info",
	"status.done": "bg-success",
	"priority.low": "bg-tone-teal",
	"priority.high": "bg-warning",
	"priority.urgent": "bg-destructive",
	"severity.minor": "bg-tone-yellow",
	"severity.major": "bg-tone-orange",
	"effort.s": "bg-tone-green",
	"effort.l": "bg-tone-violet",
};

const FIELDS: readonly CascaderNode[] = [
	{
		value: "status",
		label: "Status",
		children: [
			{ value: "status.todo", label: "To do" },
			{ value: "status.doing", label: "In progress" },
			{ value: "status.done", label: "Done" },
		],
	},
	{
		value: "priority",
		label: "Priority",
		children: [
			{ value: "priority.low", label: "Low" },
			{ value: "priority.high", label: "High" },
			{ value: "priority.urgent", label: "Urgent" },
		],
	},
	{
		value: "severity",
		label: "Severity",
		children: [
			{ value: "severity.minor", label: "Minor" },
			{ value: "severity.major", label: "Major" },
		],
	},
	{
		value: "effort",
		label: "Effort",
		children: [
			{ value: "effort.s", label: "Small" },
			{ value: "effort.l", label: "Large" },
		],
	},
];

function Dot({ value }: { readonly value: string }): React.JSX.Element | null {
	const dot = DOTS[value];
	return dot === undefined ? null : <View className={cn("size-2.5 rounded-full", dot)} />;
}

/** A value's label with its coloured dot. */
function DotLabel(node: CascaderNode, _state: CascaderItemState): React.JSX.Element {
	return (
		<View className="flex-row items-center gap-2">
			<Dot value={node.value} />
			<Text className="text-body-lg font-sans text-foreground">{node.label}</Text>
		</View>
	);
}

/** The field: the group, then the value's dot and label. */
function GroupAndDot(paths: readonly (readonly CascaderNode[])[]): React.JSX.Element {
	const [path = []] = paths;
	const leaf = path.at(-1);
	return (
		<View className="flex-row items-center gap-2">
			<Text className="text-body-lg font-sans text-muted-foreground">{path.at(0)?.label ?? ""}</Text>
			{leaf === undefined ? null : <Dot value={leaf.value} />}
			<Text className="text-body-lg font-sans text-foreground">{leaf?.label ?? ""}</Text>
		</View>
	);
}

export function Cascader19Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string | null>("priority.urgent");
	return <Cascader label="Field" items={FIELDS} value={value} onChange={setValue} renderLabel={DotLabel} renderValue={GroupAndDot} />;
}
