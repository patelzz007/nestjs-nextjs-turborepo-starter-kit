import { ContextMenu } from "@workspace/ui-native/components/context-menu";
import type { DropdownMenuItemData } from "@workspace/ui-native/components/dropdown-menu";
import * as React from "react";
import { Text, View } from "react-native";

const ITEMS: readonly DropdownMenuItemData<string>[] = [
	{ value: "copy", label: "Copy" },
	{ value: "share", label: "Share" },
];
const TARGETS: readonly string[] = ["Message", "Photo", "File", "Link"];

function Target({ name, onSelect }: { readonly name: string; readonly onSelect: (value: string) => void }): React.JSX.Element {
	return (
		<View className="w-1/2 p-1">
			<ContextMenu title={name} items={ITEMS} onSelect={onSelect}>
				<View className="rounded-card h-20 items-center justify-center border border-dashed border-input">
					<Text className="text-body font-sans text-muted-foreground">{name}</Text>
				</View>
			</ContextMenu>
		</View>
	);
}

export function ContextMenu9Example(): React.JSX.Element {
	const [picked, setPicked] = React.useState<string | null>(null);
	return (
		<View className="gap-2">
			<View className="flex-row flex-wrap">
				{TARGETS.map((name: string): React.JSX.Element => (
					<Target key={name} name={name} onSelect={setPicked} />
				))}
			</View>
			<Text className="text-body font-sans text-muted-foreground">{picked === null ? "Long press any tile." : `Chose: ${picked}`}</Text>
		</View>
	);
}
