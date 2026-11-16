import { Avatar } from "@workspace/ui-native/components/avatar";
import * as React from "react";
import { AvatarGroup } from "@workspace/ui-native/components/avatar-group";

import { PEOPLE } from "./avatar-sample";

const TRIO = PEOPLE.slice(0, 3);

// Three photos closed by a muted chip counting the others.
export function Avatar11Example(): React.JSX.Element {
	return (
		<AvatarGroup label="Sofia, James, Marco and 5 others" extra={5}>
			{TRIO.map((person): React.JSX.Element => (
				<Avatar key={person.name} name={person.name} imageUrl={person.photo} size="md" />
			))}
		</AvatarGroup>
	);
}
