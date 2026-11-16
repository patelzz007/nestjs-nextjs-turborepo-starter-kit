import CalculatorIcon from "lucide-react-native/icons/calculator";
import CalendarIcon from "lucide-react-native/icons/calendar";
import CreditCardIcon from "lucide-react-native/icons/credit-card";
import SettingsIcon from "lucide-react-native/icons/settings";
import SmileIcon from "lucide-react-native/icons/smile";
import UserIcon from "lucide-react-native/icons/user";
import { CommandList, type CommandPaletteGroup } from "@workspace/ui-native/components/command-palette";
import * as React from "react";

import { ignorePress } from "../example-support";

const GROUPS: readonly CommandPaletteGroup[] = [
	{
		key: "suggestions",
		title: "Suggestions",
		items: [
			{ key: "calendar", label: "Calendar", icon: CalendarIcon, onSelect: ignorePress },
			{ key: "emoji", label: "Search emoji", icon: SmileIcon, onSelect: ignorePress },
			{ key: "calculator", label: "Calculator", icon: CalculatorIcon, disabled: true, onSelect: ignorePress },
		],
	},
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

export function Command1Example(): React.JSX.Element {
	return <CommandList groups={GROUPS} placeholder="Type a command or search…" emptyMessage="No results found." variant="card" />;
}
