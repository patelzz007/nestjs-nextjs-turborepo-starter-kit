import { Switch } from "@workspace/ui-native/components/switch";
import * as React from "react";
import { Text, View } from "react-native";

export function Switch12Example(): React.JSX.Element {
	const [checked, setChecked] = React.useState<boolean>(false);
	return (
		<View className="gap-1">
			<Switch label="Delete data on sign-out" description="This cannot be undone: your local data is wiped." destructive checked={checked} onChange={setChecked} />
			{checked ? <Text className="text-caption font-sans text-destructive-foreground">Everything on this device is erased when you sign out.</Text> : null}
		</View>
	);
}
