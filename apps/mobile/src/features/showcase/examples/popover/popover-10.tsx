import SettingsIcon from "lucide-react-native/icons/settings";
import { IconButton } from "@workspace/ui-native/components/icon-button";
import { Popover } from "@workspace/ui-native/components/popover";
import { Slider } from "@workspace/ui-native/components/slider";
import { Switch } from "@workspace/ui-native/components/switch";
import * as React from "react";
import { Text, View } from "react-native";

import { ignorePress } from "../example-support";

export function Popover10Example(): React.JSX.Element {
	const [sound, setSound] = React.useState(true);
	const [captions, setCaptions] = React.useState(false);
	const [volume, setVolume] = React.useState(70);
	const content = (
		<View className="gap-4">
			<Switch label="Sound" checked={sound} onChange={setSound} />
			<Switch label="Captions" checked={captions} onChange={setCaptions} />
			<View className="gap-1">
				<Text className="text-body font-sans text-foreground">{`Volume: ${String(volume)}%`}</Text>
				<Slider value={volume} onChange={setVolume} accessibilityLabel="Volume" disabled={!sound} />
			</View>
		</View>
	);
	return (
		<Popover content={content} accessibilityLabel="Player settings" align="end">
			<IconButton icon={SettingsIcon} label="Settings" variant="secondary" onPress={ignorePress} />
		</Popover>
	);
}
