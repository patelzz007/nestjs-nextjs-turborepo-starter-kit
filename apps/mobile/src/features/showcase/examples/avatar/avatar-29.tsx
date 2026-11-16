import { Avatar } from "@workspace/ui-native/components/avatar";
import * as React from "react";
import { AvatarGroup } from "@workspace/ui-native/components/avatar-group";
import { IconButton } from "@workspace/ui-native/components/icon-button";
import UserPlusIcon from "lucide-react-native/icons/user-plus";
import { View } from "react-native";

import { ignorePress } from "../example-support";
import { PEOPLE } from "./avatar-sample";

// A three-photo stack with a +5 chip beside a round add-person button.
export function Avatar29Example(): React.JSX.Element {
	return (
		<View className="flex-row items-center gap-2">
			<AvatarGroup label="Sofia, James, Marco and 5 others" extra={5}>
				{PEOPLE.slice(0, 3).map((person): React.JSX.Element => (
					<Avatar key={person.name} name={person.name} imageUrl={person.photo} size="md" />
				))}
			</AvatarGroup>
			<IconButton icon={UserPlusIcon} label="Add a member" onPress={ignorePress} variant="secondary" size="sm" />
		</View>
	);
}
