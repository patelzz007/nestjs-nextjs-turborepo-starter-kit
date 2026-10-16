import { Item, ItemActions, ItemContent, ItemMedia, ItemTitle } from "@workspace/ui/components/item";
import { Kbd } from "@workspace/ui/components/kbd";
import { LogOutIcon, PlusIcon, SaveIcon, SearchIcon, SettingsIcon } from "lucide-react";
import type * as React from "react";

interface ShortcutCommand {
	readonly id: string;
	readonly icon: React.JSX.Element;
	readonly label: string;
	readonly shortcut: string;
}

const COMMANDS: readonly ShortcutCommand[] = [
	{ id: "search", icon: <SearchIcon />, label: "Search", shortcut: "⌘K" },
	{ id: "new-file", icon: <PlusIcon />, label: "New File", shortcut: "⌘N" },
	{ id: "save", icon: <SaveIcon />, label: "Save", shortcut: "⌘S" },
	{ id: "settings", icon: <SettingsIcon />, label: "Settings", shortcut: "⌘," },
	{ id: "sign-out", icon: <LogOutIcon />, label: "Sign Out", shortcut: "⌘Q" },
];

/** Each row is a command, so it renders as a button (reui's sample used `href="#"` links). */
const COMMAND_BUTTON: React.JSX.Element = <button type="button" />;

export function Item7Example(): React.JSX.Element {
	return (
		<div className="mx-auto flex w-full max-w-64 flex-col gap-0.5">
			{COMMANDS.map((command: ShortcutCommand): React.JSX.Element => (
				<Item key={command.id} render={COMMAND_BUTTON} size="xs" className="text-left hover:bg-muted">
					<ItemMedia variant="icon">{command.icon}</ItemMedia>
					<ItemContent>
						<ItemTitle>{command.label}</ItemTitle>
					</ItemContent>
					<ItemActions>
						<Kbd>{command.shortcut}</Kbd>
					</ItemActions>
				</Item>
			))}
		</div>
	);
}
