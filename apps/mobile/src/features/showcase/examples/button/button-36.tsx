import { IconButton } from "@workspace/ui-native/components/icon-button";
import * as React from "react";
import { View } from "react-native";

import { ignorePress } from "../example-support";
import { SHARE_TARGETS, type SignInMethod } from "./button-sign-in-methods";

export function Button36Example(): React.JSX.Element {
	return (
		<View className="flex-row flex-wrap gap-2">
			{SHARE_TARGETS.map((target: SignInMethod): React.JSX.Element => (
				<IconButton key={target.id} icon={target.icon} label={target.label} onPress={ignorePress} />
			))}
		</View>
	);
}
