import { Avatar } from "@workspace/ui-native/components/avatar";
import * as React from "react";
import { Button } from "@workspace/ui-native/components/button";
import { View } from "react-native";

import { FIRST } from "./avatar-sample";

// A spinner over a veil while the photo is replaced, switched by a button.
export function Avatar30Example(): React.JSX.Element {
	const [loading, setLoading] = React.useState(true);
	const toggle = React.useCallback((): void => {
		setLoading((current: boolean): boolean => !current);
	}, []);
	return (
		<View className="flex-row items-center gap-4">
			<Avatar name={FIRST.name} imageUrl={FIRST.photo} loading={loading} />
			<Button label={loading ? "Finish upload" : "Upload a new photo"} variant="outline" size="sm" onPress={toggle} />
		</View>
	);
}
