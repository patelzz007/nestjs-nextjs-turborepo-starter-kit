import { Avatar } from "@workspace/ui-native/components/avatar";
import * as React from "react";
import { Pressable, Text, View } from "react-native";

import { PEOPLE } from "./avatar-sample";

// The fan with each person named under their photo once it opens.
export function Avatar24Example(): React.JSX.Element {
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
			<View className={open ? "flex-row gap-3" : "flex-row"}>
				{PEOPLE.slice(0, 4).map((person, position: number): React.JSX.Element => (
					<View key={person.name} className={open ? "items-center gap-1" : position === 0 ? "" : "-ml-2"}>
						<View className="rounded-full border-2 border-background">
							<Avatar name={person.name} imageUrl={person.photo} size="md" />
						</View>
						{open ? <Text className="text-caption font-sans text-muted-foreground">{person.name.split(" ").at(0)}</Text> : null}
					</View>
				))}
			</View>
		</Pressable>
	);
}
