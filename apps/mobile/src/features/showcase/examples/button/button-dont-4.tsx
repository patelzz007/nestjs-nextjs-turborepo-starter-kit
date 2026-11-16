import { Button } from "@workspace/ui-native/components/button";
import { Spinner } from "@workspace/ui-native/components/spinner";
import * as React from "react";
import { View } from "react-native";

import { ignorePress } from "../example-support";

export function ButtonDont4Example(): React.JSX.Element {
	return (
		<View className="flex-row items-center gap-3">
			<Spinner />
			<Button label="Save" onPress={ignorePress} />
		</View>
	);
}
