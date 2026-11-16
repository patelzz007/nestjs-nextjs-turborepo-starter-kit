import { Sidebar, type SidebarGroup } from "@workspace/ui-native/components/sidebar";
import * as React from "react";
import { View } from "react-native";

import { ignorePress } from "../example-support";

const GROUPS: readonly SidebarGroup[] = [
	{
		key: "all",
		items: Array.from({ length: 18 }, (_item: undefined, index: number) => ({ key: `page-${String(index)}`, label: `Page ${String(index + 1)}`, onPress: ignorePress })),
	},
];

export function SidebarDont1Example(): React.JSX.Element {
	return (
		<View className="h-96">
			<Sidebar groups={GROUPS} variant="inset" />
		</View>
	);
}
