import { Avatar } from "@workspace/ui-native/components/avatar";
import { Badge, type BadgeTone } from "@workspace/ui-native/components/badge";
import { CommandList, type CommandPaletteGroup, type CommandPaletteItem } from "@workspace/ui-native/components/command-palette";
import * as React from "react";

import { ignorePress } from "../example-support";

/** One person as a command: avatar, name over email, role badge. */
function person(key: string, name: string, email: string, role: string, tone: BadgeTone): CommandPaletteItem {
	return {
		key,
		label: name,
		description: email,
		keywords: [role],
		leading: <Avatar name={name} imageUrl={null} size="sm" />,
		trailing: <Badge label={role} tone={tone} size="sm" />,
		onSelect: ignorePress,
	};
}

const GROUPS: readonly CommandPaletteGroup[] = [
	{
		key: "people",
		title: "People",
		items: [
			person("ava", "Ava Patel", "ava@acme.com", "Admin", "destructive"),
			person("ben", "Ben Ortiz", "ben@acme.com", "Editor", "info"),
			person("chloe", "Chloe Kim", "chloe@acme.com", "Viewer", "neutral"),
		],
	},
];

export function Command6Example(): React.JSX.Element {
	return <CommandList groups={GROUPS} placeholder="Type a command or search…" emptyMessage="No results found." variant="card" />;
}
