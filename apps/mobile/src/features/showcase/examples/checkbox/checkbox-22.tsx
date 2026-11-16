import { Badge } from "@workspace/ui-native/components/badge";
import { Checkbox } from "@workspace/ui-native/components/checkbox";
import * as React from "react";
import { View } from "react-native";

export function Checkbox22Example(): React.JSX.Element {
	const [sync, setSync] = React.useState<boolean>(false);
	const [replies, setReplies] = React.useState<boolean>(true);
	return (
		<View className="gap-2">
			<Checkbox label="Dark mode sync" trailing={<Badge label="NEW" tone="info" variant="solid" size="sm" />} checked={sync} onChange={setSync} />
			<Checkbox label="Smart replies" trailing={<Badge label="PRO" tone="warning" variant="solid" size="sm" />} checked={replies} onChange={setReplies} />
		</View>
	);
}
