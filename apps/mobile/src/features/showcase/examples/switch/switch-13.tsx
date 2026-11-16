import { Switch } from "@workspace/ui-native/components/switch";
import * as React from "react";
import { View } from "react-native";

const PREFERENCES: readonly string[] = ["Word wrap", "Line numbers", "Minimap", "Auto save", "Format on save"];

function PreferenceRow({ preference }: { readonly preference: string }): React.JSX.Element {
	const [checked, setChecked] = React.useState<boolean>(preference !== "Minimap");
	return <Switch label={preference} size="sm" checked={checked} onChange={setChecked} />;
}

export function Switch13Example(): React.JSX.Element {
	return (
		<View className="gap-0.5">
			{PREFERENCES.map((preference: string): React.JSX.Element => (
				<PreferenceRow key={preference} preference={preference} />
			))}
		</View>
	);
}
