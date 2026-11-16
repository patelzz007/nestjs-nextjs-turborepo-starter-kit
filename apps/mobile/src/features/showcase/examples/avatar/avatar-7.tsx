import { Avatar } from "@workspace/ui-native/components/avatar";
import * as React from "react";
import CheckIcon from "lucide-react-native/icons/check";
import PlusIcon from "lucide-react-native/icons/plus";
import ShieldIcon from "lucide-react-native/icons/shield";
import StarIcon from "lucide-react-native/icons/star";
import { View } from "react-native";

import { FIRST } from "./avatar-sample";

// Corner badges holding a plus, a check, a star or a shield, each named for what it means.
export function Avatar7Example(): React.JSX.Element {
	return (
		<View className="flex-row gap-4">
			<Avatar name={FIRST.name} imageUrl={FIRST.photo} badges={[{ label: "Add a friend", icon: PlusIcon, color: "primary" }]} />
			<Avatar name={FIRST.name} imageUrl={FIRST.photo} badges={[{ label: "Verified", icon: CheckIcon, color: "success" }]} />
			<Avatar name={FIRST.name} imageUrl={FIRST.photo} badges={[{ label: "Top contributor", icon: StarIcon, color: "warning" }]} />
			<Avatar name={FIRST.name} imageUrl={FIRST.photo} badges={[{ label: "Administrator", icon: ShieldIcon, color: "destructive" }]} />
		</View>
	);
}
