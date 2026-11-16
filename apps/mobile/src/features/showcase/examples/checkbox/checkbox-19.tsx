import { Badge } from "@workspace/ui-native/components/badge";
import { Checkbox } from "@workspace/ui-native/components/checkbox";
import * as React from "react";
import { View } from "react-native";

export function Checkbox19Example(): React.JSX.Element {
	const [ai, setAi] = React.useState<boolean>(true);
	const [offline, setOffline] = React.useState<boolean>(false);
	return (
		<View className="gap-2">
			<Checkbox label="AI summaries" trailing={<Badge label="New" size="sm" />} checked={ai} onChange={setAi} />
			<Checkbox label="Offline mode" trailing={<Badge label="Beta" variant="outline" size="sm" />} checked={offline} onChange={setOffline} />
		</View>
	);
}
