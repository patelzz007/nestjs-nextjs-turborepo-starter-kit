import { Avatar } from "@workspace/ui-native/components/avatar";
import * as React from "react";
import { AvatarGroup } from "@workspace/ui-native/components/avatar-group";

import { PEOPLE } from "./avatar-sample";

// A three-person stack where only the first carries a presence dot.
export function Avatar18Example(): React.JSX.Element {
	return (
		<AvatarGroup label="Sofia (online), James and Marco">
			{PEOPLE.slice(0, 3).map((person, position: number): React.JSX.Element => (
				<Avatar key={person.name} name={person.name} imageUrl={person.photo} size="md" badges={position === 0 ? [{ label: "Online" }] : []} />
			))}
		</AvatarGroup>
	);
}
