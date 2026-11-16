import { ContextMenu } from "@workspace/ui-native/components/context-menu";
import type { DropdownMenuItemData } from "@workspace/ui-native/components/dropdown-menu";
import * as React from "react";
import { Text, View } from "react-native";

const AREA = "Long press here";

function Area(): React.JSX.Element {
	return (
		<View className="rounded-card h-32 items-center justify-center border border-dashed border-input">
			<Text className="text-body font-sans text-muted-foreground">{AREA}</Text>
		</View>
	);
}

const PEOPLE: readonly string[] = ["Ava Patel", "Ben Ortiz"];
const THEMES: readonly string[] = ["Light", "Dark", "System"];

export function ContextMenu7Example(): React.JSX.Element {
	const [person, setPerson] = React.useState("Ava Patel");
	const [theme, setTheme] = React.useState("System");
	const items: readonly DropdownMenuItemData<string>[] = [
		...PEOPLE.map((name: string): DropdownMenuItemData<string> => ({ value: `person:${name}`, label: name, kind: "radio", checked: name === person, group: "People" })),
		...THEMES.map((name: string): DropdownMenuItemData<string> => ({ value: `theme:${name}`, label: name, kind: "radio", checked: name === theme, group: "Theme" })),
	];
	const choose = React.useCallback((value: string): void => {
		const [kind, name = ""] = value.split(":");
		if (kind === "person") {
			setPerson(name);
		} else {
			setTheme(name);
		}
	}, []);
	return (
		<ContextMenu title="Settings" items={items} onSelect={choose}>
			<Area />
		</ContextMenu>
	);
}
