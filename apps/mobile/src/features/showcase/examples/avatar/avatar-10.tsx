import { Avatar } from "@workspace/ui-native/components/avatar";
import * as React from "react";
import { AvatarGroup } from "@workspace/ui-native/components/avatar-group";

import { PEOPLE } from "./avatar-sample";

const TRIO = PEOPLE.slice(0, 3);

// Three overlapping photos ringed in the background colour, with no count at the end.
export function Avatar10Example(): React.JSX.Element {
	return (
		<AvatarGroup label={TRIO.map((person) => person.name).join(", ")}>
			{TRIO.map((person): React.JSX.Element => (
				<Avatar key={person.name} name={person.name} imageUrl={person.photo} size="md" />
			))}
		</AvatarGroup>
	);
}
