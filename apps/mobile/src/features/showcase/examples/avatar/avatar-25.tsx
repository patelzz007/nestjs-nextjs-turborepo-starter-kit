import { Avatar } from "@workspace/ui-native/components/avatar";
import * as React from "react";
import { AvatarGroup } from "@workspace/ui-native/components/avatar-group";
import { Text, View } from "react-native";

import { PEOPLE } from "./avatar-sample";

// A bordered pill of four small photos and a plain count.
export function Avatar25Example(): React.JSX.Element {
	return (
		<View className="flex-row items-center gap-1.5 self-start rounded-full border border-border p-1 pr-3">
			<AvatarGroup label="Sofia, James, Marco, Emma and 12 others" size="sm">
				{PEOPLE.slice(0, 4).map((person): React.JSX.Element => (
					<Avatar key={person.name} name={person.name} imageUrl={person.photo} size="sm" />
				))}
			</AvatarGroup>
			<Text className="text-label font-sans-medium text-foreground">+12</Text>
		</View>
	);
}
