import { Sidebar, type SidebarGroup } from "@workspace/ui-native/components/sidebar";
import * as React from "react";
import { View } from "react-native";

import { ignorePress } from "../example-support";

const GROUPS: readonly SidebarGroup[] = [
	{
		key: "docs",
		label: "Documentation",
		items: [
			{
				key: "start",
				label: "Getting started",
				items: [
					{ key: "install", label: "Installation", onPress: ignorePress },
					{ key: "quick", label: "Quick start", active: true, onPress: ignorePress },
				],
			},
			{
				key: "guides",
				label: "Guides",
				items: [
					{ key: "auth", label: "Authentication", onPress: ignorePress },
					{ key: "deploy", label: "Deploying", onPress: ignorePress },
				],
			},
			{
				key: "api",
				label: "API reference",
				items: [
					{ key: "rest", label: "REST", onPress: ignorePress },
					{ key: "hooks", label: "Webhooks", onPress: ignorePress },
				],
			},
		],
	},
];

export function SidebarDo1Example(): React.JSX.Element {
	return (
		<View className="h-96">
			<Sidebar groups={GROUPS} searchPlaceholder="Search the docs" variant="inset" />
		</View>
	);
}
