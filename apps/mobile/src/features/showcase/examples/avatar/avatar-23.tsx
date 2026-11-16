import { Avatar } from "@workspace/ui-native/components/avatar";
import * as React from "react";
import { AvatarGroup } from "@workspace/ui-native/components/avatar-group";
import { Pressable } from "react-native";

import { PEOPLE } from "./avatar-sample";

// A stack that fans apart on a press (the web's hover fan), and closes on the next.
export function Avatar23Example(): React.JSX.Element {
	const [open, setOpen] = React.useState(false);
	const toggle = React.useCallback((): void => {
		setOpen((current: boolean): boolean => !current);
	}, []);
	const accessibilityState = { expanded: open };
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={open ? "Close the team" : "Show the team"}
			accessibilityState={accessibilityState}
			onPress={toggle}
			className="self-start">
			<AvatarGroup label="Sofia, James, Marco and Emma" spread={open}>
				{PEOPLE.slice(0, 4).map((person): React.JSX.Element => (
					<Avatar key={person.name} name={person.name} imageUrl={person.photo} size="md" />
				))}
			</AvatarGroup>
		</Pressable>
	);
}
