import { Avatar } from "@workspace/ui-native/components/avatar";
import * as React from "react";
import { Pressable, Text, View } from "react-native";

import { PEOPLE } from "./avatar-sample";

function Lift({
	name,
	photo,
	first,
	lifted,
	onLift,
}: {
	readonly name: string;
	readonly photo: string;
	readonly first: boolean;
	readonly lifted: boolean;
	readonly onLift: (name: string) => void;
}): React.JSX.Element {
	const lift = React.useCallback((): void => {
		onLift(name);
	}, [name, onLift]);
	const accessibilityState = { selected: lifted };
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={name}
			accessibilityState={accessibilityState}
			onPress={lift}
			className={`rounded-full border-2 border-background ${first ? "" : "-ml-2"} ${lifted ? "-translate-y-1" : ""}`}>
			<Avatar name={name} imageUrl={photo} size="md" accessibilityLabel={name} />
		</Pressable>
	);
}

// A tap lifts a photo out of the stack and names it (the web's hover lift: a phone has no hover).
export function Avatar22Example(): React.JSX.Element {
	const [lifted, setLifted] = React.useState<string | null>(null);
	return (
		<View className="gap-2">
			<View className="flex-row">
				{PEOPLE.slice(0, 4).map((person, position: number): React.JSX.Element => (
					<Lift key={person.name} name={person.name} photo={person.photo} first={position === 0} lifted={lifted === person.name} onLift={setLifted} />
				))}
			</View>
			<Text accessibilityLiveRegion="polite" className="text-caption font-sans text-muted-foreground">
				{lifted ?? "Tap a photo"}
			</Text>
		</View>
	);
}
