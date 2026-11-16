import { CommandList, type CommandPaletteGroup } from "@workspace/ui-native/components/command-palette";
import * as React from "react";

import { ignorePress } from "../example-support";

const GROUPS: readonly CommandPaletteGroup[] = [
	{
		key: "only",
		title: "Navigation",
		items: [
			{ key: "home", label: "Home", onSelect: ignorePress },
			{ key: "inbox", label: "Inbox", onSelect: ignorePress },
		],
	},
];

export function CommandDont2Example(): React.JSX.Element {
	return <CommandList groups={GROUPS} placeholder="Type a command or search…" emptyMessage="No results found." variant="card" />;
}
