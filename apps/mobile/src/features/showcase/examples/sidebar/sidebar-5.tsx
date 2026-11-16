import FolderIcon from "lucide-react-native/icons/folder";
import PinIcon from "lucide-react-native/icons/pin";
import RefreshCwIcon from "lucide-react-native/icons/refresh-cw";
import { IconButton } from "@workspace/ui-native/components/icon-button";
import { Progress } from "@workspace/ui-native/components/progress";
import { Sidebar, type SidebarGroup } from "@workspace/ui-native/components/sidebar";
import * as React from "react";
import { Text, View } from "react-native";

import { ignorePress } from "../example-support";

const GROUPS: readonly SidebarGroup[] = [
	{
		key: "pinned",
		label: "Pinned",
		items: [{ key: "roadmap", label: "Roadmap", icon: PinIcon, pinned: true, onPress: ignorePress }],
	},
	{
		key: "projects",
		label: "Projects",
		items: [
			{ key: "web", label: "Website", icon: FolderIcon, onPress: ignorePress },
			{ key: "app", label: "Mobile app", icon: FolderIcon, onPress: ignorePress },
			{ key: "api", label: "Public API", icon: FolderIcon, onPress: ignorePress },
		],
	},
];
const USAGE = "3 of 5 projects";

export function Sidebar5Example(): React.JSX.Element {
	const [loading, setLoading] = React.useState(false);
	const refresh = React.useCallback((): void => {
		setLoading((value: boolean): boolean => !value);
	}, []);
	const header = (
		<View className="flex-row items-center justify-between">
			<Text className="text-body-lg font-sans-semibold text-foreground">Projects</Text>
			<IconButton icon={RefreshCwIcon} label={loading ? "Stop refreshing" : "Refresh"} variant="ghost" size="sm" onPress={refresh} />
		</View>
	);
	const footer = (
		<View className="gap-1 p-2">
			<Text className="text-caption font-sans text-muted-foreground">{USAGE}</Text>
			<Progress value={60} accessibilityLabel="Plan usage" />
		</View>
	);
	return (
		<View className="h-96">
			<Sidebar groups={GROUPS} header={header} footer={footer} searchPlaceholder="Filter projects" loading={loading} emptyMessage="No projects match." variant="inset" />
		</View>
	);
}
