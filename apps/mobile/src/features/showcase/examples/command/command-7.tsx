import FolderPlusIcon from "lucide-react-native/icons/folder-plus";
import LayoutDashboardIcon from "lucide-react-native/icons/layout-dashboard";
import LogOutIcon from "lucide-react-native/icons/log-out";
import MoonIcon from "lucide-react-native/icons/moon";
import SettingsIcon from "lucide-react-native/icons/settings";
import UserPlusIcon from "lucide-react-native/icons/user-plus";
import { Button } from "@workspace/ui-native/components/button";
import { CommandPalette, type CommandPaletteGroup } from "@workspace/ui-native/components/command-palette";
import * as React from "react";

import { ignorePress } from "../example-support";

const GROUPS: readonly CommandPaletteGroup[] = [
	{
		key: "create",
		title: "Create",
		items: [
			{ key: "project", label: "New project", icon: FolderPlusIcon, tone: "blue", shortcut: ["⌘", "N"], onSelect: ignorePress },
			{ key: "invite", label: "Invite member", icon: UserPlusIcon, tone: "green", shortcut: ["⌘", "I"], onSelect: ignorePress },
		],
	},
	{
		key: "navigate",
		title: "Navigate",
		items: [
			{ key: "dashboard", label: "Go to dashboard", icon: LayoutDashboardIcon, shortcut: ["G", "D"], onSelect: ignorePress },
			{ key: "settings", label: "Go to settings", icon: SettingsIcon, shortcut: ["G", "S"], onSelect: ignorePress },
		],
	},
	{
		key: "system",
		title: "System",
		items: [
			{ key: "dark", label: "Toggle dark mode", icon: MoonIcon, shortcut: ["⌘", "D"], onSelect: ignorePress },
			{ key: "signout", label: "Sign out", icon: LogOutIcon, tone: "red", onSelect: ignorePress },
		],
	},
];

export function Command7Example(): React.JSX.Element {
	const [open, setOpen] = React.useState(false);
	const show = React.useCallback((): void => {
		setOpen(true);
	}, []);
	const hide = React.useCallback((): void => {
		setOpen(false);
	}, []);
	return (
		<>
			<Button label="Actions" variant="outline" onPress={show} />
			<CommandPalette visible={open} onClose={hide} groups={GROUPS} title="Actions" placeholder="Type a command or search…" emptyMessage="No results found." />
		</>
	);
}
