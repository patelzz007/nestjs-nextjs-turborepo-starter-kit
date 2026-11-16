import { Badge } from "@workspace/ui-native/components/badge";
import { Switch } from "@workspace/ui-native/components/switch";
import * as React from "react";
import { View } from "react-native";

export function Switch10Example(): React.JSX.Element {
	const [ai, setAi] = React.useState<boolean>(true);
	const [cursors, setCursors] = React.useState<boolean>(false);
	return (
		<View className="gap-2">
			<Switch label="AI assistant" trailing={<Badge label="New" size="sm" />} checked={ai} onChange={setAi} />
			<Switch label="Live cursors" trailing={<Badge label="Beta" tone="warning" size="sm" />} checked={cursors} onChange={setCursors} />
		</View>
	);
}
