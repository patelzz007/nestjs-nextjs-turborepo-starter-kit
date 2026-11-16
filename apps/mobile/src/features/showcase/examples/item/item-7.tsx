import { Icon, type LucideIcon } from "@workspace/ui-native/components/icon";
import { Item, ItemActions, ItemContent, ItemMedia, ItemTitle } from "@workspace/ui-native/components/item";
import { Kbd } from "@workspace/ui-native/components/kbd";
import LogOutIcon from "lucide-react-native/icons/log-out";
import PlusIcon from "lucide-react-native/icons/plus";
import SaveIcon from "lucide-react-native/icons/save";
import SearchIcon from "lucide-react-native/icons/search";
import SettingsIcon from "lucide-react-native/icons/settings";
import * as React from "react";
import { View } from "react-native";

import { ignorePress } from "../example-support";

interface ShortcutCommand {
	readonly icon: LucideIcon;
	readonly label: string;
	readonly shortcut: string;
}

const COMMANDS: readonly ShortcutCommand[] = [
	{ icon: SearchIcon, label: "Search", shortcut: "⌘K" },
	{ icon: PlusIcon, label: "New File", shortcut: "⌘N" },
	{ icon: SaveIcon, label: "Save", shortcut: "⌘S" },
	{ icon: SettingsIcon, label: "Settings", shortcut: "⌘," },
	{ icon: LogOutIcon, label: "Sign Out", shortcut: "⌘Q" },
];

// Each row is a command, so it is a button; the shortcut works on a phone with a hardware keyboard.
export function Item7Example(): React.JSX.Element {
	return (
		<View className="gap-0.5">
			{COMMANDS.map((command: ShortcutCommand): React.JSX.Element => (
				<Item key={command.label} size="xs" onPress={ignorePress} accessibilityLabel={command.label} accessibilityRole="button">
					<ItemMedia variant="icon">
						<Icon icon={command.icon} size="sm" colorClassName="accent-foreground" />
					</ItemMedia>
					<ItemContent>
						<ItemTitle>{command.label}</ItemTitle>
					</ItemContent>
					<ItemActions>
						<Kbd label={command.shortcut} />
					</ItemActions>
				</Item>
			))}
		</View>
	);
}
