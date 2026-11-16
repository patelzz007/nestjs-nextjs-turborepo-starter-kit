import { Avatar } from "@workspace/ui-native/components/avatar";
import * as React from "react";
import { AvatarGroup } from "@workspace/ui-native/components/avatar-group";

import { PEOPLE } from "./avatar-sample";

const TRIO = PEOPLE.slice(0, 3);

// Three photos ending in a round plus chip in place of a number.
export function Avatar12Example(): React.JSX.Element {
	return (
		<AvatarGroup label="Sofia, James, Marco and others" countDisplay="plus">
			{TRIO.map((person): React.JSX.Element => (
				<Avatar key={person.name} name={person.name} imageUrl={person.photo} size="md" />
			))}
		</AvatarGroup>
	);
}
