import { IconButton } from "@workspace/ui-native/components/icon-button";
import * as React from "react";
import { View } from "react-native";

import { ignorePress } from "../example-support";
import { SIGN_IN_METHODS, type SignInMethod } from "./button-sign-in-methods";

export function Button60Example(): React.JSX.Element {
	return (
		<View className="flex-row gap-2">
			{SIGN_IN_METHODS.map((method: SignInMethod): React.JSX.Element => (
				<IconButton key={method.id} icon={method.icon} label={`Log in with ${method.label}`} glyphClassName={method.toneClassName} onPress={ignorePress} className="flex-1" />
			))}
		</View>
	);
}
