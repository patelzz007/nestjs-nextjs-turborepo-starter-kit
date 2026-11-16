import { Avatar } from "@workspace/ui-native/components/avatar";
import * as React from "react";
import { Button } from "@workspace/ui-native/components/button";
import { EmptyState } from "@workspace/ui-native/components/empty";
import { Icon } from "@workspace/ui-native/components/icon";
import UserPlusIcon from "lucide-react-native/icons/user-plus";
import { View } from "react-native";

import { ignorePress } from "../example-support";
import { PEOPLE } from "./avatar-sample";

// An empty state inviting collaborators: three muted photos, an add-person chip and a button.
export function Avatar28Example(): React.JSX.Element {
	return (
		<EmptyState title="No collaborators yet" message="Invite your team to edit this project together.">
			<View className="flex-row items-center opacity-60">
				{PEOPLE.slice(0, 3).map((person, position: number): React.JSX.Element => (
					<View key={person.name} className={position === 0 ? "rounded-full border-2 border-background" : "-ml-2 rounded-full border-2 border-background"}>
						<Avatar name={person.name} imageUrl={person.photo} size="md" />
					</View>
				))}
				<View className="-ml-2 size-9 items-center justify-center rounded-full border-2 border-dashed border-border bg-background">
					<Icon icon={UserPlusIcon} size="xs" colorClassName="accent-muted-foreground" />
				</View>
			</View>
			<Button label="Invite people" size="sm" onPress={ignorePress} />
		</EmptyState>
	);
}
