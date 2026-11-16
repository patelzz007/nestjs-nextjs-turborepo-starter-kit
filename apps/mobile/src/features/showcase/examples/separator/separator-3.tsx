import { Separator } from "@workspace/ui-native/components/separator";
import * as React from "react";
import { Text, View } from "react-native";

interface MenuEntry {
	readonly title: string;
	readonly caption: string;
}

const ENTRIES: readonly MenuEntry[] = [
	{ title: "Settings", caption: "Manage preferences" },
	{ title: "Account", caption: "Profile & security" },
	{ title: "Help", caption: "Support & docs" },
];

export function Separator3Example(): React.JSX.Element {
	return (
		<View className="flex-row items-center gap-3 self-center">
			{ENTRIES.map((entry: MenuEntry, index: number): React.JSX.Element => (
				<React.Fragment key={entry.title}>
					{index === 0 ? null : <Separator orientation="vertical" className="h-8 self-center" />}
					<View className="gap-1">
						<Text className="text-label font-sans-medium text-foreground">{entry.title}</Text>
						<Text className="text-caption font-sans text-muted-foreground">{entry.caption}</Text>
					</View>
				</React.Fragment>
			))}
		</View>
	);
}
