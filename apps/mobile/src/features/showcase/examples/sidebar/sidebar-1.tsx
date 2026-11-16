import FolderIcon from "lucide-react-native/icons/folder";
import HouseIcon from "lucide-react-native/icons/house";
import InboxIcon from "lucide-react-native/icons/inbox";
import SettingsIcon from "lucide-react-native/icons/settings";
import UsersIcon from "lucide-react-native/icons/users";
import { Avatar } from "@workspace/ui-native/components/avatar";
import { DropdownMenu, type DropdownMenuItemData } from "@workspace/ui-native/components/dropdown-menu";
import { Sidebar, type SidebarGroup } from "@workspace/ui-native/components/sidebar";
import * as React from "react";
import { Text, View } from "react-native";

import { ignorePress } from "../example-support";

const GROUPS: readonly SidebarGroup[] = [
	{
		key: "main",
		items: [
			{ key: "home", label: "Home", icon: HouseIcon, active: true, onPress: ignorePress },
			{ key: "inbox", label: "Inbox", icon: InboxIcon, badge: "12", onPress: ignorePress },
			{ key: "projects", label: "Projects", icon: FolderIcon, onPress: ignorePress },
		],
	},
	{
		key: "workspace",
		label: "Workspace",
		items: [
			{ key: "team", label: "Team", icon: UsersIcon, onPress: ignorePress },
			{ key: "settings", label: "Settings", icon: SettingsIcon, onPress: ignorePress },
		],
	},
];

const WORKSPACES: readonly DropdownMenuItemData<string>[] = [
	{ value: "Acme Inc.", label: "Acme Inc." },
	{ value: "Studio North", label: "Studio North" },
];

export function Sidebar1Example(): React.JSX.Element {
	const [workspace, setWorkspace] = React.useState("Acme Inc.");
	const header = (
		<DropdownMenu
			label={workspace}
			leading={<Avatar name={workspace} imageUrl={null} shape="rounded" size="sm" />}
			items={WORKSPACES}
			onSelect={setWorkspace}
			variant="ghost"
			className="self-stretch"
		/>
	);
	return (
		<View className="h-96 flex-row gap-3">
			<Sidebar groups={GROUPS} header={header} variant="inset" className="w-56" />
			<View className="flex-1 gap-2">
				<Text className="text-caption font-sans text-muted-foreground">{`${workspace} / Home`}</Text>
				<View className="rounded-card h-16 border border-border bg-card" />
				<View className="rounded-card h-16 border border-border bg-card" />
			</View>
		</View>
	);
}
