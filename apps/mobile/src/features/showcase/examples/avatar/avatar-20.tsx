import { Avatar } from "@workspace/ui-native/components/avatar";
import * as React from "react";
import { AvatarGroup } from "@workspace/ui-native/components/avatar-group";
import { Text, View } from "react-native";

import { PEOPLE } from "./avatar-sample";

// Social proof: a bordered pill with four stacked photos and a bold figure.
export function Avatar20Example(): React.JSX.Element {
	return (
		<View className="flex-row items-center gap-2 self-start rounded-full border border-border px-2 py-1">
			<AvatarGroup label="Four happy customers" size="sm">
				{PEOPLE.slice(0, 4).map((person): React.JSX.Element => (
					<Avatar key={person.name} name={person.name} imageUrl={person.photo} size="sm" />
				))}
			</AvatarGroup>
			<Text className="text-label font-sans text-muted-foreground">
				<Text className="font-sans-bold text-foreground">100K+</Text> happy customers
			</Text>
		</View>
	);
}
