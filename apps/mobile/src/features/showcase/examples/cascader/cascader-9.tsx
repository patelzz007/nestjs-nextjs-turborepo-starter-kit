import { Button } from "@workspace/ui-native/components/button";
import { type CascaderChangeDetails, CascaderPanel } from "@workspace/ui-native/components/cascader";
import type { CascaderNode } from "@workspace/ui-native/lib/cascader";
import * as React from "react";
import { Text, View } from "react-native";

const MENU: readonly CascaderNode[] = [
	{
		value: "starters",
		label: "Starters",
		children: [
			{ value: "soup", label: "Tomato soup" },
			{ value: "salad", label: "Caesar salad" },
		],
	},
	{
		value: "mains",
		label: "Mains",
		children: [
			{ value: "risotto", label: "Mushroom risotto" },
			{ value: "steak", label: "Steak frites" },
		],
	},
	{ value: "desserts", label: "Desserts", children: [{ value: "tiramisu", label: "Tiramisu" }] },
];

const MAINS: readonly string[] = ["mains"];
const TOP: readonly string[] = [];

export function Cascader9Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string | null>(null);
	const [path, setPath] = React.useState<readonly string[]>(TOP);
	const [query, setQuery] = React.useState("");
	const [log, setLog] = React.useState("Nothing picked yet.");
	const change = React.useCallback((next: string, details: CascaderChangeDetails): void => {
		setValue(next);
		setLog(`${details.reason}: ${details.path.map((node: CascaderNode): string => node.label).join(" › ")}`);
	}, []);
	const showMains = React.useCallback((): void => {
		setQuery("");
		setPath(MAINS);
	}, []);
	const searchSoup = React.useCallback((): void => {
		setQuery("soup");
	}, []);
	return (
		<View className="gap-3">
			<View className="flex-row gap-2">
				<Button label="Open Mains" variant="outline" size="sm" onPress={showMains} />
				<Button label="Search “soup”" variant="outline" size="sm" onPress={searchSoup} />
			</View>
			<CascaderPanel items={MENU} value={value} onChange={change} path={path} onPathChange={setPath} query={query} onQueryChange={setQuery} listSize="sm" />
			<Text className="text-body font-mono text-muted-foreground">{log}</Text>
		</View>
	);
}
