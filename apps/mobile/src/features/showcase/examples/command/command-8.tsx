import BookOpenIcon from "lucide-react-native/icons/book-open";
import ClockIcon from "lucide-react-native/icons/clock";
import LifeBuoyIcon from "lucide-react-native/icons/life-buoy";
import StarIcon from "lucide-react-native/icons/star";
import { Text } from "react-native";
import { Button } from "@workspace/ui-native/components/button";
import { CommandPalette, type CommandPaletteGroup } from "@workspace/ui-native/components/command-palette";
import * as React from "react";

import { ignorePress } from "../example-support";

const GROUPS: readonly CommandPaletteGroup[] = [
	{
		key: "favorites",
		title: "Favorites",
		items: [
			{ key: "roadmap", label: "Roadmap", icon: StarIcon, tone: "yellow", onSelect: ignorePress },
			{ key: "okrs", label: "Q4 goals", icon: StarIcon, tone: "yellow", onSelect: ignorePress },
		],
	},
	{
		key: "recent",
		title: "Recent",
		items: [
			{ key: "invoices", label: "Invoices", icon: ClockIcon, trailing: <Text className="text-caption font-sans text-muted-foreground">2m ago</Text>, onSelect: ignorePress },
			{ key: "team", label: "Team settings", icon: ClockIcon, trailing: <Text className="text-caption font-sans text-muted-foreground">1h ago</Text>, onSelect: ignorePress },
			{ key: "billing", label: "Billing", icon: ClockIcon, trailing: <Text className="text-caption font-sans text-muted-foreground">2h ago</Text>, onSelect: ignorePress },
		],
	},
	{
		key: "help",
		title: "Help",
		items: [
			{ key: "docs", label: "Documentation", icon: BookOpenIcon, onSelect: ignorePress },
			{ key: "support", label: "Contact support", icon: LifeBuoyIcon, onSelect: ignorePress },
		],
	},
];

export function Command8Example(): React.JSX.Element {
	const [open, setOpen] = React.useState(false);
	const show = React.useCallback((): void => {
		setOpen(true);
	}, []);
	const hide = React.useCallback((): void => {
		setOpen(false);
	}, []);
	return (
		<>
			<Button label="Search…" variant="outline" onPress={show} />
			<CommandPalette visible={open} onClose={hide} groups={GROUPS} title="Search" placeholder="Type a command or search…" emptyMessage="No results found." />
		</>
	);
}
