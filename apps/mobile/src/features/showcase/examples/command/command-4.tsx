import { Button } from "@workspace/ui-native/components/button";
import { CommandPalette, type CommandPaletteGroup } from "@workspace/ui-native/components/command-palette";
import * as React from "react";

import { ignorePress } from "../example-support";

const GROUPS: readonly CommandPaletteGroup[] = [
	{
		key: "nav",
		title: "Navigation",
		items: [
			{ key: "nav-0", label: "Home", onSelect: ignorePress },
			{ key: "nav-1", label: "Inbox", onSelect: ignorePress },
			{ key: "nav-2", label: "Projects", onSelect: ignorePress },
			{ key: "nav-3", label: "Calendar", onSelect: ignorePress },
			{ key: "nav-4", label: "Reports", onSelect: ignorePress },
		],
	},
	{
		key: "files",
		title: "Files",
		items: [
			{ key: "files-0", label: "New file", onSelect: ignorePress },
			{ key: "files-1", label: "Open file", onSelect: ignorePress },
			{ key: "files-2", label: "Save", onSelect: ignorePress },
			{ key: "files-3", label: "Save as", onSelect: ignorePress },
			{ key: "files-4", label: "Export", onSelect: ignorePress },
		],
	},
	{
		key: "view",
		title: "View",
		items: [
			{ key: "view-0", label: "Zoom in", onSelect: ignorePress },
			{ key: "view-1", label: "Zoom out", onSelect: ignorePress },
			{ key: "view-2", label: "Full screen", onSelect: ignorePress },
			{ key: "view-3", label: "Toggle sidebar", onSelect: ignorePress },
		],
	},
	{
		key: "account",
		title: "Account",
		items: [
			{ key: "account-0", label: "Profile", onSelect: ignorePress },
			{ key: "account-1", label: "Billing", onSelect: ignorePress },
			{ key: "account-2", label: "Team", onSelect: ignorePress },
			{ key: "account-3", label: "Sign out", onSelect: ignorePress },
		],
	},
	{
		key: "tools",
		title: "Tools",
		items: [
			{ key: "tools-0", label: "Calculator", onSelect: ignorePress },
			{ key: "tools-1", label: "Color picker", onSelect: ignorePress },
			{ key: "tools-2", label: "Terminal", onSelect: ignorePress },
			{ key: "tools-3", label: "Logs", onSelect: ignorePress },
			{ key: "tools-4", label: "Settings", onSelect: ignorePress },
		],
	},
];

export function Command4Example(): React.JSX.Element {
	const [open, setOpen] = React.useState(false);
	const show = React.useCallback((): void => {
		setOpen(true);
	}, []);
	const hide = React.useCallback((): void => {
		setOpen(false);
	}, []);
	return (
		<>
			<Button label="Open palette" variant="outline" onPress={show} />
			<CommandPalette visible={open} onClose={hide} groups={GROUPS} title="Command palette" placeholder="Type a command or search…" emptyMessage="No results found." />
		</>
	);
}
