import PanelLeftIcon from "lucide-react-native/icons/panel-left";
import FolderIcon from "lucide-react-native/icons/folder";
import HouseIcon from "lucide-react-native/icons/house";
import InboxIcon from "lucide-react-native/icons/inbox";
import SettingsIcon from "lucide-react-native/icons/settings";
import UsersIcon from "lucide-react-native/icons/users";
import { Avatar } from "@workspace/ui-native/components/avatar";
import { IconButton } from "@workspace/ui-native/components/icon-button";
import { IconTile } from "@workspace/ui-native/components/icon-tile";
import { Sidebar, type SidebarGroup } from "@workspace/ui-native/components/sidebar";
import * as React from "react";
import { View } from "react-native";

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

export function Sidebar2Example(): React.JSX.Element {
	const [collapsed, setCollapsed] = React.useState(false);
	const toggle = React.useCallback((): void => {
		setCollapsed((value: boolean): boolean => !value);
	}, []);
	const header = (
		<View className="flex-row items-center justify-between gap-2">
			<IconTile icon={HouseIcon} tone="brand" size="sm" />
			{collapsed ? null : <IconButton icon={PanelLeftIcon} label="Collapse the sidebar" variant="ghost" size="sm" onPress={toggle} />}
		</View>
	);
	const footer = collapsed ? (
		<IconButton icon={PanelLeftIcon} label="Expand the sidebar" variant="ghost" size="sm" onPress={toggle} />
	) : (
		<Avatar name="Ava Patel" imageUrl={null} size="sm" />
	);
	return (
		<View className="h-96 flex-row">
			<Sidebar groups={GROUPS} header={header} footer={footer} collapsed={collapsed} className={collapsed ? undefined : "w-56"} />
		</View>
	);
}
