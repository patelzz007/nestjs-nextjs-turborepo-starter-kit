import CreditCardIcon from "lucide-react-native/icons/credit-card";
import SettingsIcon from "lucide-react-native/icons/settings";
import UserIcon from "lucide-react-native/icons/user";
import { Button } from "@workspace/ui-native/components/button";
import { CommandPalette, type CommandPaletteGroup } from "@workspace/ui-native/components/command-palette";
import * as React from "react";

import { ignorePress } from "../example-support";

const GROUPS: readonly CommandPaletteGroup[] = [
	{
		key: "settings",
		title: "Settings",
		items: [
			{ key: "profile", label: "Profile", icon: UserIcon, shortcut: ["⌘", "P"], onSelect: ignorePress },
			{ key: "billing", label: "Billing", icon: CreditCardIcon, shortcut: ["⌘", "B"], onSelect: ignorePress },
			{ key: "settings", label: "Settings", icon: SettingsIcon, shortcut: ["⌘", "S"], onSelect: ignorePress },
		],
	},
];

export function Command2Example(): React.JSX.Element {
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
