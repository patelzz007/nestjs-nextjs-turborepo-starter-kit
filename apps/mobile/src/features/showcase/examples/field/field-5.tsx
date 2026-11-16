import { Field } from "@workspace/ui-native/components/field";
import { Slider } from "@workspace/ui-native/components/slider";
import { Switch } from "@workspace/ui-native/components/switch";
import * as React from "react";
import { Text, View } from "react-native";

export function Field5Example(): React.JSX.Element {
	const [autoSave, setAutoSave] = React.useState<boolean>(true);
	const [volume, setVolume] = React.useState<number>(50);
	return (
		<View className="gap-6">
			<Switch label="Auto-save drafts" description="Saves as you type." checked={autoSave} onChange={setAutoSave} />
			<Field label="Volume" labelTrailing={<Text className="text-caption font-sans text-muted-foreground tabular-nums">{`${String(volume)}%`}</Text>}>
				<Slider value={volume} onChange={setVolume} min={0} max={100} step={5} accessibilityLabel="Volume" />
			</Field>
		</View>
	);
}
