import { Button } from "@workspace/ui-native/components/button";
import { Icon } from "@workspace/ui-native/components/icon";
import * as React from "react";
import { View } from "react-native";

import { ignorePress } from "../example-support";
import { SIGN_IN_METHODS, type SignInMethod } from "./button-sign-in-methods";

export function Button59Example(): React.JSX.Element {
	return (
		<View className="gap-2">
			{SIGN_IN_METHODS.map((method: SignInMethod): React.JSX.Element => (
				<Button
					key={method.id}
					label={`Log in with ${method.label}`}
					variant="outline"
					leading={<Icon icon={method.icon} size="sm" colorClassName={method.toneClassName} />}
					onPress={ignorePress}
				/>
			))}
		</View>
	);
}
