import { Avatar } from "@workspace/ui-native/components/avatar";
import * as React from "react";

import { AvatarGroup } from "@workspace/ui-native/components/avatar-group";

const NAMES: readonly string[] = [
	"Ada Lovelace",
	"Alan Turing",
	"Grace Hopper",
	"Linus Torvalds",
	"Barbara Liskov",
	"Edsger Dijkstra",
	"Margaret Hamilton",
	"Katherine Johnson",
	"Donald Knuth",
	"Ken Thompson",
	"Dennis Ritchie",
];

export function AvatarDont2Example(): React.JSX.Element {
	return (
		<AvatarGroup label="Eleven people">
			{NAMES.map((name: string): React.JSX.Element => (
				<Avatar key={name} name={name} imageUrl={null} size="md" />
			))}
		</AvatarGroup>
	);
}
